import unittest

from box_state import BoxOccupancyMachine, NormalizedROI
from camera_worker import (
    CameraBoxConfig,
    IPCameraManager,
    compute_roi_diff_score,
    run_capture_burst,
)
from provisioning import Esp32PairingStore, build_camera_endpoints


class IPCameraPipelineTests(unittest.TestCase):
    def test_box_occupancy_ignores_brief_noise_and_confirms_arrival(self):
        machine = BoxOccupancyMachine(
            "box-1",
            arrival_threshold=0.18,
            exit_threshold=0.08,
            arrival_confirm_seconds=2.0,
            exit_confirm_seconds=10.0,
            post_capture_cooldown_seconds=5.0,
        )
        # Brief 1s glitch -> returns to empty
        s1 = machine.update(0.25, now=0.0)
        self.assertEqual(s1.state, "confirming_arrival")
        self.assertEqual(s1.action, "none")

        s2 = machine.update(0.03, now=1.0)
        self.assertEqual(s2.state, "empty")

        # Sustained presence >= 2s -> starts capture
        machine.update(0.24, now=10.0)
        s3 = machine.update(0.26, now=12.1)
        self.assertEqual(s3.state, "capturing")
        self.assertEqual(s3.action, "start_capture")

        # Complete capture -> occupied; stays occupied even with high motion
        machine.complete_capture(car_present=True, now=17.1)
        s4 = machine.update(0.35, now=25.0)
        self.assertEqual(s4.state, "occupied")
        self.assertEqual(s4.action, "none")

        # Exit confirmation requires 10s empty
        s5 = machine.update(0.02, now=40.0)
        self.assertEqual(s5.state, "confirming_exit")
        s6 = machine.update(0.01, now=50.5)
        self.assertEqual(s6.state, "empty")
        self.assertEqual(s6.action, "car_left")

    def test_capture_burst_auto_registers_visit_at_80_percent_after_5_frames(self):
        config = CameraBoxConfig(
            box_id="box-2",
            low_stream_url="rtsp://cam2/sub",
            high_stream_url="rtsp://cam2/main",
        )
        frames = iter([
            (b"\xff\xd8\xffframe0", ("01A777BC", 0.72)),
            (b"\xff\xd8\xffframe1", ("01A777BC", 0.88)),
            (b"\xff\xd8\xffframe2", (None, 0.0)),  # 1 noisy frame
            (b"\xff\xd8\xffframe3", ("01A777BC", 0.94)),  # highest confidence
            (b"\xff\xd8\xffframe4", ("01A777BC", 0.81)),
        ])
        finalized_calls = []
        pending_calls = []

        def grab_stub(_cfg):
            jpeg, _ = next(frames)
            grab_stub.last_ocr = None
            return jpeg

        def ocr_stub(jpeg):
            mapping = {
                b"\xff\xd8\xffframe0": ("01A777BC", 0.72),
                b"\xff\xd8\xffframe1": ("01A777BC", 0.88),
                b"\xff\xd8\xffframe2": (None, 0.0),
                b"\xff\xd8\xffframe3": ("01A777BC", 0.94),
                b"\xff\xd8\xffframe4": ("01A777BC", 0.81),
            }
            return mapping[jpeg]

        clock = [0.0]

        def fake_now():
            return clock[0]

        def fake_sleep(sec):
            clock[0] += sec

        outcome = run_capture_burst(
            config,
            grab_high_res=grab_stub,
            recognize_plate=ocr_stub,
            on_finalized=lambda box_id, plate, jpeg, decision: finalized_calls.append(
                (box_id, plate, jpeg, decision)
            ),
            on_pending=lambda *args: pending_calls.append(args),
            interval_seconds=1.0,
            sleep_fn=fake_sleep,
            now_fn=fake_now,
        )

        self.assertEqual(outcome.decision.status, "finalized")
        self.assertEqual(outcome.decision.plate, "01A777BC")
        self.assertEqual(outcome.decision.agreement, 0.8)
        self.assertEqual(outcome.frames_taken, 5)
        self.assertTrue(outcome.auto_visit_registered)
        self.assertEqual(len(finalized_calls), 1)
        self.assertEqual(len(pending_calls), 0)
        # Picks the highest-confidence JPEG for the winning plate
        self.assertEqual(finalized_calls[0][2], b"\xff\xd8\xffframe3")

    def test_capture_burst_aborts_on_5_empty_frames(self):
        config = CameraBoxConfig(
            box_id="box-3",
            low_stream_url="rtsp://cam3/sub",
            high_stream_url="rtsp://cam3/main",
        )
        finalized_calls = []

        outcome = run_capture_burst(
            config,
            grab_high_res=lambda _c: b"\xff\xd8\xffempty",
            recognize_plate=lambda _b: (None, 0.0),
            on_finalized=lambda *args: finalized_calls.append(args),
            interval_seconds=0.0,
        )
        self.assertEqual(outcome.decision.status, "aborted")
        self.assertEqual(outcome.decision.reason, "no_plate")
        self.assertEqual(outcome.frames_taken, 5)
        self.assertFalse(outcome.auto_visit_registered)
        self.assertEqual(len(finalized_calls), 0)

    def test_roi_diff_ignores_outside_changes(self):
        w, h = 10, 10
        baseline = bytearray([20] * (w * h))
        current = bytearray([20] * (w * h))
        # Change only top row (y=0), outside ROI (y=0.3..0.9)
        for x in range(w):
            current[x] = 200
        roi = NormalizedROI(x=0.2, y=0.3, w=0.6, h=0.6)
        score = compute_roi_diff_score(bytes(baseline), bytes(current), w, h, roi)
        self.assertEqual(score, 0.0)

    def test_manager_supports_up_to_20_boxes(self):
        manager = IPCameraManager(max_boxes=20)
        for i in range(1, 21):
            manager.register_box(
                CameraBoxConfig(
                    box_id=f"box-{i}",
                    low_stream_url=f"rtsp://10.0.0.{i}/sub",
                    high_stream_url=f"rtsp://10.0.0.{i}/main",
                )
            )
        self.assertEqual(len(manager.list_states()), 20)
        with self.assertRaises(ValueError):
            manager.register_box(
                CameraBoxConfig(
                    box_id="box-21",
                    low_stream_url="rtsp://10.0.0.21/sub",
                    high_stream_url="rtsp://10.0.0.21/main",
                )
            )

    def test_camera_endpoint_builder_generates_dual_streams(self):
        hik = build_camera_endpoints(
            brand="hikvision",
            host="192.168.1.105",
            username="admin",
            password="secret",
        )
        self.assertIn("/Streaming/Channels/102", hik.low_stream_url)
        self.assertIn("/Streaming/Channels/101", hik.high_stream_url)
        self.assertIn("/ISAPI/Streaming/channels/101/picture", hik.snapshot_url or "")

        dahua = build_camera_endpoints(
            brand="dahua",
            host="192.168.1.106",
            username="admin",
            password="secret",
        )
        self.assertIn("subtype=1", dahua.low_stream_url)
        self.assertIn("subtype=0", dahua.high_stream_url)

    def test_esp32_pairing_code_is_single_use_and_expirable(self):
        store = Esp32PairingStore(ttl_seconds=300)
        token = store.issue_code("box-4", now=100.0)
        self.assertEqual(len(token.code), 6)

        claimed = store.claim_code(token.code, device_key="dev-key-123", now=150.0)
        self.assertEqual(claimed["box_id"], "box-4")
        self.assertEqual(claimed["device_key"], "dev-key-123")

        with self.assertRaises(ValueError):
            store.claim_code(token.code, device_key="dev-key-123", now=160.0)

        expired_token = store.issue_code("box-5", now=200.0)
        with self.assertRaises(ValueError):
            store.claim_code(expired_token.code, device_key="dev-key-123", now=600.0)


if __name__ == "__main__":
    unittest.main()
