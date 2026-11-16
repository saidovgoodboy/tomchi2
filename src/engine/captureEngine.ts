export type CaptureDecisionStatus = 'continue' | 'finalized' | 'pending' | 'aborted';

export interface CaptureDecision {
  status: CaptureDecisionStatus;
  plate: string | null;
  votes: number;
  agreement: number;
  reason: string;
}

/**
 * Mirrors backend/app/capture.py CaptureSession rules:
 * - minFrames: 5 (no finalization before 5 frames)
 * - windowSize: 5 (rolling window)
 * - agreementThreshold: 0.8 (80%)
 * - maxFrames: 15
 * - noPlateAbortStreak: 5
 */
export class CaptureSessionEngine {
  readonly eventId: string;
  readonly minFrames: number;
  readonly windowSize: number;
  readonly agreementThreshold: number;
  readonly maxFrames: number;
  readonly noPlateAbortStreak: number;

  window: Array<string | null> = [];
  framesSeen = 0;
  noPlateStreak = 0;
  decision: CaptureDecision | null = null;

  constructor(
    eventId: string,
    opts?: {
      minFrames?: number;
      windowSize?: number;
      agreementThreshold?: number;
      maxFrames?: number;
      noPlateAbortStreak?: number;
    },
  ) {
    this.eventId = eventId;
    this.minFrames = opts?.minFrames ?? 5;
    this.windowSize = opts?.windowSize ?? 5;
    this.agreementThreshold = opts?.agreementThreshold ?? 0.8;
    this.maxFrames = opts?.maxFrames ?? 15;
    this.noPlateAbortStreak = opts?.noPlateAbortStreak ?? 5;
  }

  onFrame(plate: string | null): {
    decision: CaptureDecision;
    topPlate: string | null;
    votes: number;
    windowLength: number;
    agreement: number;
  } {
    if (this.decision) {
      return {
        decision: this.decision,
        topPlate: this.decision.plate,
        votes: this.decision.votes,
        windowLength: this.window.length,
        agreement: this.decision.agreement,
      };
    }

    this.framesSeen += 1;
    if (plate === null) {
      this.noPlateStreak += 1;
    } else {
      this.noPlateStreak = 0;
    }

    this.window.push(plate);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }

    const { top, count } = this.majority();
    const agreement = this.window.length > 0 ? count / this.window.length : 0;

    if (this.noPlateStreak >= this.noPlateAbortStreak) {
      this.decision = {
        status: 'aborted',
        plate: null,
        votes: 0,
        agreement: 0,
        reason: 'no_plate',
      };
      return {
        decision: this.decision,
        topPlate: null,
        votes: 0,
        windowLength: this.window.length,
        agreement: 0,
      };
    }

    if (this.framesSeen >= this.minFrames && top !== null && agreement >= this.agreementThreshold) {
      this.decision = {
        status: 'finalized',
        plate: top,
        votes: count,
        agreement,
        reason: 'consensus_reached',
      };
      return {
        decision: this.decision,
        topPlate: top,
        votes: count,
        windowLength: this.window.length,
        agreement,
      };
    }

    if (this.framesSeen >= this.maxFrames) {
      this.decision =
        top === null
          ? {
              status: 'aborted',
              plate: null,
              votes: 0,
              agreement: 0,
              reason: 'no_reading',
            }
          : {
              status: 'pending',
              plate: top,
              votes: count,
              agreement,
              reason: 'agreement_not_reached',
            };
      return {
        decision: this.decision,
        topPlate: top,
        votes: count,
        windowLength: this.window.length,
        agreement,
      };
    }

    return {
      decision: {
        status: 'continue',
        plate: top,
        votes: count,
        agreement,
        reason: '',
      },
      topPlate: top,
      votes: count,
      windowLength: this.window.length,
      agreement,
    };
  }

  private majority(): { top: string | null; count: number } {
    const counts = new Map<string, number>();
    for (const item of this.window) {
      if (item !== null) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
    let bestPlate: string | null = null;
    let bestCount = 0;
    for (const [plate, count] of counts.entries()) {
      if (count > bestCount) {
        bestPlate = plate;
        bestCount = count;
      }
    }
    return { top: bestPlate, count: bestCount };
  }
}

export const PLATE_REGEX = /^(?:\d{2}[A-Z]\d{3}[A-Z]{2}|\d{5}[A-Z]{3})$/;

export function normalizePlate(raw: string): string {
  return raw.trim().replace(/[-\s]/g, '').toUpperCase();
}
