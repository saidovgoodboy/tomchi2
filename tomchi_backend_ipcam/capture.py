"""ANPR kadrlar oqimi uchun qaror mashinasi.

Har bir mashina kirish hodisasi (motion/occupancy) uchun bitta ``CaptureSession``
yaratiladi. Yuqori sifatli kadrlar har 1 soniyada olinadi; har kadrda
o'qilgan davlat raqami nomzodi (``plate``) yoki ``None`` beriladi.

Qaror qoidalari:
- Kamida ``min_frames`` (standart 5) kadr tahlil qilinmaguncha yakuniy qaror
  chiqmaydi (bitta omadli kadr 100% bersa ham darhol visit yozilmaydi).
- So'nggi ``window_size`` (standart 5) kadrda eng ko'p takrorlangan raqam ulushi
  ``agreement_threshold`` (standart 0.80 = 80%) dan katta yoki teng bo'lsa ->
  ``finalized`` (avtomatik visit + bonus yoqiladi).
- Ketma-ket ``no_plate_abort_streak`` (standart 5) kadrda raqam topilmasa ->
  ``aborted`` (soxta harakat).
- ``max_frames`` (standart 15) yoki ``max_session_seconds`` (standart 20 s)
  chegarasiga yetganda -> best-effort (raqam nomzodi bo'lsa ``pending``,
  bo'lmasa ``aborted``).
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
import time
from typing import Literal


@dataclass(frozen=True)
class Decision:
    status: Literal["continue", "finalized", "pending", "aborted"]
    plate: str | None = None
    votes: int = 0
    agreement: float = 0.0
    reason: str = ""
    best_frame_index: int | None = None

    @property
    def terminal(self) -> bool:
        return self.status != "continue"


class CaptureSession:
    def __init__(
        self,
        event_id: str,
        *,
        min_frames: int = 5,
        window_size: int = 5,
        agreement_threshold: float = 0.8,
        max_frames: int = 15,
        max_session_seconds: float = 20.0,
        no_plate_abort_streak: int = 5,
    ) -> None:
        if min_frames < 1:
            raise ValueError("min_frames must be >= 1")
        if window_size < 1:
            raise ValueError("window_size must be >= 1")
        if not 0.0 < agreement_threshold <= 1.0:
            raise ValueError("agreement_threshold must be in (0, 1]")

        self.event_id = event_id
        self.min_frames = min_frames
        self.window_size = window_size
        self.agreement_threshold = agreement_threshold
        self.max_frames = max_frames
        self.max_session_seconds = max_session_seconds
        self.no_plate_abort_streak = no_plate_abort_streak

        self.window: deque[str | None] = deque(maxlen=window_size)
        self.frames_seen = 0
        self.no_plate_streak = 0
        self.started_at = time.monotonic()
        self._decision: Decision | None = None
        self._best_frame_by_plate: dict[str, tuple[float, int, bytes]] = {}

    @property
    def finished(self) -> bool:
        return self._decision is not None

    @property
    def decision(self) -> Decision | None:
        return self._decision

    def best_frame_for(self, plate: str | None) -> bytes | None:
        if not plate:
            return None
        entry = self._best_frame_by_plate.get(plate)
        return entry[2] if entry is not None else None

    def on_frame(
        self,
        plate: str | None,
        *,
        confidence: float = 1.0,
        frame_bytes: bytes | None = None,
        now: float | None = None,
    ) -> Decision:
        """Yangi kadr natijasini qabul qilib, qarorni qaytaradi."""
        if self._decision is not None:
            return self._decision

        frame_index = self.frames_seen
        self.frames_seen += 1

        if plate is None:
            self.no_plate_streak += 1
        else:
            self.no_plate_streak = 0
            if frame_bytes is not None:
                prev = self._best_frame_by_plate.get(plate)
                if prev is None or confidence > prev[0]:
                    self._best_frame_by_plate[plate] = (confidence, frame_index, frame_bytes)

        self.window.append(plate)
        current = now if now is not None else time.monotonic()

        if self.no_plate_streak >= self.no_plate_abort_streak:
            self._decision = Decision(status="aborted", reason="no_plate")
            return self._decision

        if self.frames_seen >= self.min_frames:
            top, count = self._majority()
            agreement = count / len(self.window)
            if top is not None and agreement >= self.agreement_threshold:
                best_idx = (
                    self._best_frame_by_plate[top][1]
                    if top in self._best_frame_by_plate
                    else None
                )
                self._decision = Decision(
                    status="finalized",
                    plate=top,
                    votes=count,
                    agreement=agreement,
                    best_frame_index=best_idx,
                )
                return self._decision

        elapsed = current - self.started_at
        if self.frames_seen >= self.max_frames or elapsed >= self.max_session_seconds:
            self._decision = self._best_effort()
            return self._decision

        return Decision(status="continue")

    def _majority(self) -> tuple[str | None, int]:
        plates = [p for p in self.window if p is not None]
        if not plates:
            return None, 0
        top, count = Counter(plates).most_common(1)[0]
        return top, count

    def _best_effort(self) -> Decision:
        plates = [p for p in self.window if p is not None]
        if not plates:
            return Decision(status="aborted", reason="no_reading")
        top, count = Counter(plates).most_common(1)[0]
        best_idx = (
            self._best_frame_by_plate[top][1]
            if top in self._best_frame_by_plate
            else None
        )
        return Decision(
            status="pending",
            plate=top,
            votes=count,
            agreement=count / len(self.window),
            reason="agreement_not_reached",
            best_frame_index=best_idx,
        )
