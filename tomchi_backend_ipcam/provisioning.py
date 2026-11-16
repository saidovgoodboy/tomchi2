"""IP kamera va ESP32 P10 panelni oson ulash (Zero-Config Provisioning) yordamchilari.

1. Kamera ulash: Foydalanuvchi RTSP URL ni qo'lda yozmasdan, brend (Hikvision,
   Dahua, Uniview, Generic ONVIF), IP, login va parolni kiritganda tizim
   sub-stream, main-stream va snapshot URL larni avtomatik yasaydi.
2. ESP32 ulash: Admin panelda tanlangan box uchun 6 xonali vaqtinchalik ulash
   kodi (masalan, ``482910``) yaratiladi. Bitta universal proshivkali ESP32
   captive portalga kiritilgan shu kod bilan ``POST /api/devices/pair`` ga
   so'rov yuborib, o'zining ``box_id`` va ``device_key`` sini avtomatik oladi.
"""

from __future__ import annotations

from dataclasses import dataclass
import secrets
import time
from typing import Literal
from urllib.parse import quote

CameraBrand = Literal["hikvision", "dahua", "uniview", "onvif_generic"]


@dataclass(frozen=True)
class CameraEndpoints:
    brand: CameraBrand
    low_stream_url: str
    high_stream_url: str
    snapshot_url: str | None


def build_camera_endpoints(
    *,
    brand: CameraBrand,
    host: str,
    username: str,
    password: str,
    rtsp_port: int = 554,
    http_port: int = 80,
    channel: int = 1,
) -> CameraEndpoints:
    host_clean = host.strip()
    if not host_clean:
        raise ValueError("Camera IP/host is required")
    user_enc = quote(username.strip(), safe="")
    pass_enc = quote(password, safe="")
    auth = f"{user_enc}:{pass_enc}@" if user_enc else ""

    if brand == "hikvision":
        main_ch = channel * 100 + 1
        sub_ch = channel * 100 + 2
        return CameraEndpoints(
            brand=brand,
            low_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/Streaming/Channels/{sub_ch}",
            high_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/Streaming/Channels/{main_ch}",
            snapshot_url=f"http://{auth}{host_clean}:{http_port}/ISAPI/Streaming/channels/{main_ch}/picture",
        )
    if brand == "dahua":
        return CameraEndpoints(
            brand=brand,
            low_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/cam/realmonitor?channel={channel}&subtype=1",
            high_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/cam/realmonitor?channel={channel}&subtype=0",
            snapshot_url=f"http://{auth}{host_clean}:{http_port}/cgi-bin/snapshot.cgi?channel={channel}",
        )
    if brand == "uniview":
        return CameraEndpoints(
            brand=brand,
            low_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/unicast/c{channel}/s1/live",
            high_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/unicast/c{channel}/s0/live",
            snapshot_url=f"http://{auth}{host_clean}:{http_port}/LAPI/V1.0/Channels/{channel - 1}/Media/Video/Streams/0/Snapshot",
        )
    # onvif_generic
    return CameraEndpoints(
        brand=brand,
        low_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/stream2",
        high_stream_url=f"rtsp://{auth}{host_clean}:{rtsp_port}/stream1",
        snapshot_url=None,
    )


@dataclass
class PairingToken:
    code: str
    box_id: str
    expires_at: float
    used: bool = False


class Esp32PairingStore:
    """Bitta universal ESP32 proshivkasi uchun 6 xonali ulash kodlari ombori."""

    def __init__(self, ttl_seconds: int = 600) -> None:
        self.ttl_seconds = ttl_seconds
        self._tokens: dict[str, PairingToken] = {}

    def issue_code(self, box_id: str, now: float | None = None) -> PairingToken:
        current = now if now is not None else time.monotonic()
        self._purge_expired(current)
        code = f"{secrets.randbelow(900000) + 100000}"
        token = PairingToken(code=code, box_id=box_id, expires_at=current + self.ttl_seconds)
        self._tokens[code] = token
        return token

    def claim_code(
        self,
        code: str,
        *,
        device_key: str,
        now: float | None = None,
    ) -> dict[str, str]:
        current = now if now is not None else time.monotonic()
        self._purge_expired(current)
        token = self._tokens.get(code.strip())
        if token is None or token.used or token.expires_at <= current:
            raise ValueError("Invalid or expired pairing code")
        token.used = True
        return {
            "box_id": token.box_id,
            "device_key": device_key,
        }

    def _purge_expired(self, now: float) -> None:
        expired = [k for k, v in self._tokens.items() if v.used or v.expires_at <= now]
        for key in expired:
            self._tokens.pop(key, None)
