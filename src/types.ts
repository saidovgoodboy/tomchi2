export type Language = 'uz' | 'ru';
export type Theme = 'light' | 'dark';
export type UiMode = 'simple' | 'pro';
export type TabKey = 'boxes' | 'anpr' | 'visits' | 'server';
export type CameraBrand = 'hikvision' | 'dahua' | 'uniview' | 'onvif_generic';

export type BoxOccupancyState =
  | 'empty'
  | 'confirming_arrival'
  | 'capturing'
  | 'occupied'
  | 'confirming_exit';

export type VehiclePreset = 'sedan' | 'suv';

export interface NormalizedROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WashBox {
  id: string;
  name: string;
  state: BoxOccupancyState;
  cameraBrand: CameraBrand;
  cameraIp: string;
  lowStreamUrl: string;
  highStreamUrl: string;
  snapshotUrl: string;
  useVaapi: boolean;
  roi: NormalizedROI;
  occupancyScore: number;
  currentPlate: string | null;
  activeBonusLeft: number;
  vehicleVisual: 'empty' | VehiclePreset;
  lastCaptureStatus: 'idle' | 'finalized' | 'pending' | 'aborted';
  lastAgreement: number | null;
  displayText: string;
  esp32Paired: boolean;
  pairingCode: string | null;
}

export interface CaptureFrameLog {
  frameIndex: number;
  timestamp: string;
  plate: string | null;
  confidence: number;
  windowVotes: number;
  windowLength: number;
  agreement: number;
  decisionStatus: 'continue' | 'finalized' | 'pending' | 'aborted';
}

export interface VisitRecord {
  id: number;
  plate: string;
  boxId: string;
  visitNo: number;
  createdAt: string;
  bonusTotal: number;
  bonusLeft: number;
  isActiveBonus: boolean;
  agreementPct: number | null;
  framesUsed: number;
  source: 'auto_80_anpr' | 'manual_confirmed';
  imageUrl: string;
}

export interface PendingDetection {
  id: number;
  boxId: string;
  eventId: string;
  suggestedPlate: string | null;
  votes: number;
  framesTaken: number;
  agreementPct: number;
  createdAt: string;
  imageUrl: string;
}

export interface BonusPulseRecord {
  id: number;
  visitId: number;
  boxId: string;
  plate: string;
  amount: number;
  pressId: string;
  createdAt: string;
  refundedAt: string | null;
}

export interface BonusSettings {
  bonusAmount: number;
  bonusPerPress: number;
  bonusEveryVisits: number;
  pulseValue: number;
}
