export interface PythonCodeFile {
  filename: string;
  summaryUz: string;
  summaryRu: string;
  code: string;
}

export const PYTHON_BACKEND_FILES: PythonCodeFile[] = [
  {
    filename: 'install.sh',
    summaryUz:
      "Linux + AMD RX 580 serverga 1 ta buyruq bilan o'rnatish: FFmpeg, Tesseract, Mesa VA-API, Python venv, xavfsiz .env va systemd servisi.",
    summaryRu:
      'Установка в 1 команду на Linux + AMD RX 580: FFmpeg, Tesseract, Mesa VA-API, Python venv, .env и systemd сервис.',
    code: `#!/usr/bin/env bash
set -euo pipefail
APP_DIR="\${TOMCHI_DIR:-/opt/tomchi}"

apt-get update -qq
apt-get install -y -qq python3 python3-venv ffmpeg tesseract-ocr mesa-va-drivers vainfo

# RX 580 VA-API tekshiruvi: /dev/dri/renderD128
usermod -aG video,render tomchi || true

# Avtomatik .env (DEVICE_KEY, ADMIN_TOKEN_SECRET, ADMIN_PASSWORD)
# va /etc/systemd/system/tomchi.service yaratiladi hamda ishga tushiriladi.
systemctl enable --now tomchi.service`,
  },
  {
    filename: 'backend/app/provisioning.py',
    summaryUz:
      "Kamera brendi + IP + login/paroldan RTSP/Snapshot URL yaratish va universal ESP32 proshivkasi uchun 6 xonali ulash kodi.",
    summaryRu:
      'Генерация RTSP/Snapshot URL по бренду и IP камеры, а также 6-значный код сопряжения для универсальной прошивки ESP32.',
    code: `def build_camera_endpoints(brand: str, host: str, username: str, password: str):
    # Hikvision / Dahua / Uniview / Generic ONVIF uchun avtomatik URL yasaydi
    # Masalan Hikvision:
    # low:  rtsp://user:pass@IP:554/Streaming/Channels/102
    # high: rtsp://user:pass@IP:554/Streaming/Channels/101
    # snap: http://user:pass@IP:80/ISAPI/Streaming/channels/101/picture
    ...

class Esp32PairingStore:
    def issue_code(self, box_id: str) -> PairingToken:
        # 10 daqiqalik bir martalik 6 xonali kod (masalan 482910)
        ...
    def claim_code(self, code: str, *, device_key: str) -> dict[str, str]:
        # ESP32 captive portaldan kodni yuboradi va box_id + device_key oladi
        ...`,
  },
  {
    filename: 'backend/app/box_state.py',
    summaryUz:
      "Past sifatli sub-stream ROI o'zgarishiga qarab box holatini boshqaradi (empty -> confirming_arrival -> capturing -> occupied -> confirming_exit).",
    summaryRu:
      'Управляет состоянием бокса по ROI на низкокачественном потоке (empty -> confirming_arrival -> capturing -> occupied -> confirming_exit).',
    code: `from dataclasses import dataclass
from typing import Literal

BoxStateName = Literal[
    "empty", "confirming_arrival", "capturing", "occupied", "confirming_exit"
]

@dataclass(frozen=True)
class NormalizedROI:
    x: float = 0.20
    y: float = 0.30
    w: float = 0.60
    h: float = 0.58

class BoxOccupancyMachine:
    def __init__(
        self,
        box_id: str,
        *,
        arrival_threshold: float = 0.18,
        exit_threshold: float = 0.08,
        arrival_confirm_seconds: float = 2.0,
        exit_confirm_seconds: float = 10.0,
        post_capture_cooldown_seconds: float = 5.0,
    ) -> None:
        self.box_id = box_id
        self.arrival_threshold = arrival_threshold
        self.exit_threshold = exit_threshold
        self.arrival_confirm_seconds = arrival_confirm_seconds
        self.exit_confirm_seconds = exit_confirm_seconds
        self.post_capture_cooldown_seconds = post_capture_cooldown_seconds
        self.state: BoxStateName = "empty"
        self._transition_started_at: float | None = None
        self._last_capture_finished_at: float = -1e9`,
  },
  {
    filename: 'backend/app/camera_worker.py',
    summaryUz:
      "3-20 ta IP kamera uchun FFmpeg VA-API (RX 580) sub-stream kuzatuvchisi va mashina kirganda 1 FPS yuqori sifatli CaptureSession ishga tushiruvchi worker.",
    summaryRu:
      'Многокамерный воркер (3-20 боксов): FFmpeg VA-API (RX 580) sub-stream + 1 FPS высококачественный захват с CaptureSession.',
    code: `def build_substream_ffmpeg_cmd(config: CameraBoxConfig) -> list[str]:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-rtsp_transport", "tcp"]
    if config.use_vaapi:
        cmd.extend(["-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD128"])
    cmd.extend([
        "-i", config.low_stream_url,
        "-vf", f"fps={config.sub_stream_fps},scale=320:240,format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
    ])
    return cmd

def run_capture_burst(config, grab_high_res, recognize_plate, on_finalized, on_pending):
    session = CaptureSession(
        event_id=f"{config.box_id}-{uuid4().hex[:12]}",
        min_frames=5,
        window_size=5,
        agreement_threshold=0.80,
        max_frames=15,
        no_plate_abort_streak=5,
    )
    while not session.finished:
        jpeg = grab_high_res(config)   # 1 ta yuqori sifatli kadr (har 1 s da)
        plate, conf = recognize_plate(jpeg)
        decision = session.on_frame(plate, confidence=conf, frame_bytes=jpeg)
        if decision.terminal:
            break
        time.sleep(1.0)

    if session.decision.status == "finalized" and session.decision.plate:
        # 80% tasdiqlanganda avtomatik Visit + Bonus yoqiladi
        on_finalized(config.box_id, session.decision.plate, session.best_frame_for(session.decision.plate), session.decision)`,
  },
  {
    filename: 'backend/app/main.py (integratsiya)',
    summaryUz:
      "FastAPI lifespan ichida IPCameraManager ishga tushadi; finalized natija kelganda avtomatik process_plate_detection(db, plate, box_id) chaqiriladi.",
    summaryRu:
      'Запуск IPCameraManager в FastAPI lifespan и автоматический вызов process_plate_detection(db, plate, box_id) при достижении 80%.',
    code: `def handle_finalized_plate(box_id: str, plate: str, best_jpeg: bytes | None, decision: Decision) -> None:
    with SessionLocal() as db:
        result = process_plate_detection(db, plate, box_id)
        if best_jpeg:
            image_key = uuid4().hex
            save_detection_image(settings.storage_dir, image_key, best_jpeg)
            db.add(DetectionRecord(
                box_id=box_id,
                event_key=f"ipcam-{image_key}",
                image_key=image_key,
                plate=plate,
                ocr_confidence=decision.agreement,
                status="confirmed",
                visit_id=result["visit_id"],
            ))
        db.add(DeviceLog(
            event="ipcam_auto_visit",
            payload=f"{box_id}:{plate}:votes={decision.votes}:agree={decision.agreement:.2f}",
        ))
        db.commit()`,
  },
];
