import {
  Camera,
  Cpu,
  LayoutGrid,
  Menu,
  Moon,
  Plus,
  Receipt,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AnprPipelineView, type BurstPresetKey } from './components/AnprPipelineView';
import { BoxMonitorView } from './components/BoxMonitorView';
import { ServerArchView } from './components/ServerArchView';
import { VisitsBonusView } from './components/VisitsBonusView';
import {
  BAY_IMAGES,
  DEFAULT_BONUS_SETTINGS,
  INITIAL_BOXES,
  INITIAL_PULSES,
  INITIAL_VISITS,
  createBoxTemplate,
} from './data/initialData';
import { CaptureSessionEngine, PLATE_REGEX, normalizePlate } from './engine/captureEngine';
import type {
  BonusPulseRecord,
  BonusSettings,
  CameraBrand,
  CaptureFrameLog,
  Language,
  NormalizedROI,
  PendingDetection,
  TabKey,
  Theme,
  UiMode,
  VehiclePreset,
  VisitRecord,
  WashBox,
} from './types';

const NAV_ITEMS: Array<{
  key: TabKey;
  uz: string;
  ru: string;
  icon: typeof LayoutGrid;
  proOnly?: boolean;
}> = [
  { key: 'boxes', uz: 'Boxlar nazorati', ru: 'Монитор боксов', icon: LayoutGrid },
  { key: 'anpr', uz: 'Kamera va 80% ANPR', ru: 'Камера и 80% ANPR', icon: Camera, proOnly: true },
  { key: 'visits', uz: 'Kelishlar va Bonus', ru: 'Визиты и Бонус', icon: Receipt },
  { key: 'server', uz: 'Linux + RX 580 & Kod', ru: 'Linux + RX 580 и Код', icon: Cpu, proOnly: true },
];

function buildBurstSequence(
  preset: BurstPresetKey,
  targetPlate: string,
): Array<{ plate: string | null; confidence: number }> {
  const plate = PLATE_REGEX.test(normalizePlate(targetPlate))
    ? normalizePlate(targetPlate)
    : '01A888BC';

  if (preset === 'consensus_5_5') {
    return [
      { plate, confidence: 0.89 },
      { plate, confidence: 0.92 },
      { plate, confidence: 0.95 },
      { plate, confidence: 0.91 },
      { plate, confidence: 0.94 },
    ];
  }
  if (preset === 'consensus_4_5') {
    return [
      { plate, confidence: 0.85 },
      { plate: null, confidence: 0.0 },
      { plate, confidence: 0.91 },
      { plate, confidence: 0.94 },
      { plate, confidence: 0.89 },
    ];
  }
  if (preset === 'empty_abort') {
    return Array.from({ length: 5 }, () => ({ plate: null, confidence: 0.0 }));
  }
  // mixed_pending: 15 frames alternating without hitting 80% in any 5-frame window
  const altPlate = plate === '01B222CD' ? '01C333EF' : '01B222CD';
  return Array.from({ length: 15 }, (_, idx) =>
    idx % 2 === 0 ? { plate, confidence: 0.66 } : { plate: altPlate, confidence: 0.61 },
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>('uz');
  const [theme, setTheme] = useState<Theme>('light');
  const [uiMode, setUiMode] = useState<UiMode>('pro');
  const [activeTab, setActiveTab] = useState<TabKey>('boxes');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [boxes, setBoxes] = useState<WashBox[]>(INITIAL_BOXES);
  const [selectedBoxId, setSelectedBoxId] = useState<string>(INITIAL_BOXES[0].id);
  const [visits, setVisits] = useState<VisitRecord[]>(INITIAL_VISITS);
  const [pending, setPending] = useState<PendingDetection[]>([]);
  const [pulses, setPulses] = useState<BonusPulseRecord[]>(INITIAL_PULSES);
  const [bonusSettings, setBonusSettings] = useState<BonusSettings>(DEFAULT_BONUS_SETTINGS);

  const [activeCaptureBoxId, setActiveCaptureBoxId] = useState<string | null>(null);
  const [frameLogs, setFrameLogs] = useState<CaptureFrameLog[]>([]);
  const [lastOutcomeText, setLastOutcomeText] = useState<string | null>(null);

  const burstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current);
      }
    };
  }, []);

  const registerAutoVisitAndBonus = (
    boxId: string,
    plate: string,
    agreement: number,
    framesUsed: number,
    source: 'auto_80_anpr' | 'manual_confirmed',
    visual: VehiclePreset,
  ) => {
    const existingForPlate = visits.filter((v) => v.plate === plate);
    const nextVisitNo = existingForPlate.length + 1;
    const earnsBonus = nextVisitNo % bonusSettings.bonusEveryVisits === 0;
    const awardedAmount = earnsBonus ? bonusSettings.bonusAmount : 0;

    const newVisit: VisitRecord = {
      id: Date.now(),
      plate,
      boxId,
      visitNo: nextVisitNo,
      createdAt: new Date().toISOString(),
      bonusTotal: awardedAmount,
      bonusLeft: awardedAmount,
      isActiveBonus: earnsBonus,
      agreementPct: Math.round(agreement * 100),
      framesUsed,
      source,
      imageUrl: visual === 'suv' ? BAY_IMAGES.suv : BAY_IMAGES.sedan,
    };

    setVisits((prev) => {
      // Single active bonus rule across the entire wash station
      const cleared = earnsBonus
        ? prev.map((v) => (v.isActiveBonus ? { ...v, isActiveBonus: false, bonusLeft: 0 } : v))
        : prev;
      return [newVisit, ...cleared];
    });

    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id === boxId) {
          const bonusText = earnsBonus
            ? `${plate} - ${nextVisitNo}-KELISH! MUKOFOT ${awardedAmount.toLocaleString('fr-FR')} SO'M`
            : `${plate} - ${nextVisitNo}-KELISH`;
          return {
            ...b,
            state: 'occupied',
            occupancyScore: 0.72,
            currentPlate: plate,
            activeBonusLeft: earnsBonus ? awardedAmount : 0,
            vehicleVisual: visual,
            lastCaptureStatus: 'finalized',
            lastAgreement: agreement,
            displayText: bonusText,
          };
        }
        if (earnsBonus && b.activeBonusLeft > 0) {
          return {
            ...b,
            activeBonusLeft: 0,
            displayText: b.currentPlate ? `${b.currentPlate} - MUKOFOT BEKOR` : "AVTOMOBIL YO'Q",
          };
        }
        return b;
      }),
    );

    return { visitNo: nextVisitNo, earnsBonus, awardedAmount };
  };

  const runBurstSession = (
    boxId: string,
    preset: BurstPresetKey,
    customPlate: string,
    visual: VehiclePreset = 'sedan',
  ) => {
    if (burstTimerRef.current !== null) {
      window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = null;
    }

    const sequence = buildBurstSequence(preset, customPlate);
    const engine = new CaptureSessionEngine(`${boxId}-${Date.now()}`, {
      minFrames: 5,
      windowSize: 5,
      agreementThreshold: 0.8,
      maxFrames: 15,
      noPlateAbortStreak: 5,
    });

    setSelectedBoxId(boxId);
    setActiveCaptureBoxId(boxId);
    setFrameLogs([]);
    setLastOutcomeText(null);

    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? {
              ...b,
              state: 'capturing',
              occupancyScore: 0.65,
              vehicleVisual: preset === 'empty_abort' ? 'empty' : visual,
              currentPlate: null,
              displayText: 'ANIQLANMOQDA...',
            }
          : b,
      ),
    );

    let stepIndex = 0;

    const tick = () => {
      const item = sequence[stepIndex];
      const stepResult = engine.onFrame(item.plate);
      const nowStr = new Date().toISOString().slice(11, 19);

      const logEntry: CaptureFrameLog = {
        frameIndex: stepIndex + 1,
        timestamp: nowStr,
        plate: item.plate,
        confidence: item.confidence,
        windowVotes: stepResult.votes,
        windowLength: stepResult.windowLength,
        agreement: stepResult.agreement,
        decisionStatus: stepResult.decision.status,
      };

      setFrameLogs((prev) => [...prev, logEntry]);

      if (stepResult.decision.status !== 'continue' || stepIndex + 1 >= sequence.length) {
        setActiveCaptureBoxId(null);
        burstTimerRef.current = null;

        if (stepResult.decision.status === 'finalized' && stepResult.decision.plate) {
          const outcome = registerAutoVisitAndBonus(
            boxId,
            stepResult.decision.plate,
            stepResult.decision.agreement,
            engine.framesSeen,
            'auto_80_anpr',
            visual,
          );
          setLastOutcomeText(
            language === 'uz'
              ? `Tasdiqlandi (${Math.round(stepResult.decision.agreement * 100)}%): ${stepResult.decision.plate} · ${outcome.visitNo}-kelish avtomatik yaratildi${
                  outcome.earnsBonus
                    ? ` va ${outcome.awardedAmount.toLocaleString('fr-FR')} so'm bonus faollashdi`
                    : ''
                }.`
              : `Подтверждено (${Math.round(stepResult.decision.agreement * 100)}%): ${stepResult.decision.plate} · визит #${outcome.visitNo} создан автоматически.`,
          );
        } else if (stepResult.decision.status === 'pending') {
          const pendingItem: PendingDetection = {
            id: Date.now(),
            boxId,
            eventId: engine.eventId,
            suggestedPlate: stepResult.decision.plate,
            votes: stepResult.decision.votes,
            framesTaken: engine.framesSeen,
            agreementPct: Math.round(stepResult.decision.agreement * 100),
            createdAt: new Date().toISOString(),
            imageUrl: visual === 'suv' ? BAY_IMAGES.suv : BAY_IMAGES.sedan,
          };
          setPending((prev) => [pendingItem, ...prev]);
          setBoxes((prev) =>
            prev.map((b) =>
              b.id === boxId
                ? {
                    ...b,
                    state: 'occupied',
                    lastCaptureStatus: 'pending',
                    lastAgreement: stepResult.decision.agreement,
                    displayText: 'ADMIN TEKSHIRUVI KUTILMOQDA',
                  }
                : b,
            ),
          );
          setLastOutcomeText(
            language === 'uz'
              ? `15 kadrda 80% ga yetmadi (${Math.round(stepResult.decision.agreement * 100)}%). Kelishlar bo‘limiga Pending sifatida yuborildi.`
              : `За 15 кадров не набрано 80% (${Math.round(stepResult.decision.agreement * 100)}%). Отправлено в Pending.`,
          );
        } else {
          setBoxes((prev) =>
            prev.map((b) =>
              b.id === boxId
                ? {
                    ...b,
                    state: 'empty',
                    occupancyScore: 0.03,
                    vehicleVisual: 'empty',
                    currentPlate: null,
                    lastCaptureStatus: 'aborted',
                    lastAgreement: 0,
                    displayText: "AVTOMOBIL YO'Q",
                  }
                : b,
            ),
          );
          setLastOutcomeText(
            language === 'uz'
              ? 'Ketma-ket 5 kadrda raqam topilmadi — sessiya bekor qilindi (aborted).'
              : '5 пустых кадров подряд — сессия отменена (aborted).',
          );
        }
        return;
      }

      stepIndex += 1;
      burstTimerRef.current = window.setTimeout(tick, 750);
    };

    burstTimerRef.current = window.setTimeout(tick, 450);
  };

  const handleSimulateArrivalFromMonitor = (boxId: string, preset: VehiclePreset) => {
    const samplePlates = ['01N405BC', '01A777BC', '10M884BA', '01Z909FA'];
    const boxNum = Number(boxId.replace('box-', '')) || 1;
    const plate = samplePlates[(boxNum - 1) % samplePlates.length];
    runBurstSession(boxId, 'consensus_4_5', plate, preset);
  };

  const handleSimulateExit = (boxId: string) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? {
              ...b,
              state: 'empty',
              occupancyScore: 0.02,
              currentPlate: null,
              vehicleVisual: 'empty',
              displayText: "AVTOMOBIL YO'Q",
            }
          : b,
      ),
    );
  };

  const handleAddBox = () => {
    if (boxes.length >= 20) return;
    const next = createBoxTemplate(boxes.length);
    setBoxes((prev) => [...prev, next]);
  };

  const handleScaleTo20 = () => {
    setBoxes((prev) => {
      if (prev.length >= 20) return prev;
      const added = Array.from({ length: 20 - prev.length }, (_, idx) =>
        createBoxTemplate(prev.length + idx),
      );
      return [...prev, ...added];
    });
  };

  const handleUpdateCameraConfig = (
    boxId: string,
    patch: {
      cameraBrand: CameraBrand;
      cameraIp: string;
      lowStreamUrl: string;
      highStreamUrl: string;
      snapshotUrl: string;
      useVaapi: boolean;
      roi: NormalizedROI;
    },
  ) => {
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, ...patch } : b)));
  };

  const handleGenerateEsp32Code = (boxId: string) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, pairingCode: code } : b)));
  };

  const handleSimulateEsp32Claim = (boxId: string) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId ? { ...b, esp32Paired: true, pairingCode: null } : b,
      ),
    );
  };

  const handleUiModeChange = (nextMode: UiMode) => {
    setUiMode(nextMode);
    if (nextMode === 'simple' && (activeTab === 'anpr' || activeTab === 'server')) {
      setActiveTab('boxes');
    }
  };

  const handlePressBonus = (boxId: string) => {
    const targetBox = boxes.find((b) => b.id === boxId);
    if (!targetBox || targetBox.activeBonusLeft <= 0) return;

    const deducted = Math.min(bonusSettings.bonusPerPress, targetBox.activeBonusLeft);
    const remaining = targetBox.activeBonusLeft - deducted;

    const activeVisit = visits.find(
      (v) => v.boxId === boxId && v.isActiveBonus && v.bonusLeft > 0,
    );
    if (!activeVisit) return;

    const pressId = `p-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16).slice(-4)}`;
    const newPulse: BonusPulseRecord = {
      id: Date.now(),
      visitId: activeVisit.id,
      boxId,
      plate: activeVisit.plate,
      amount: deducted,
      pressId,
      createdAt: new Date().toISOString(),
      refundedAt: null,
    };

    setPulses((prev) => [newPulse, ...prev]);
    setVisits((prev) =>
      prev.map((v) =>
        v.id === activeVisit.id
          ? { ...v, bonusLeft: remaining, isActiveBonus: remaining > 0 }
          : v,
      ),
    );
    setBoxes((prev) =>
      prev.map((b) =>
        b.id === boxId
          ? {
              ...b,
              activeBonusLeft: remaining,
              displayText:
                remaining > 0
                  ? `MUKOFOT QOLDI: ${remaining.toLocaleString('fr-FR')} SO'M`
                  : 'MUKOFOT TUGADI',
            }
          : b,
      ),
    );
  };

  const handleRefundPulse = (pulseId: number) => {
    const pulse = pulses.find((p) => p.id === pulseId);
    if (!pulse || pulse.refundedAt !== null) return;

    const anyOtherActive = visits.some((v) => v.isActiveBonus && v.id !== pulse.visitId);
    if (anyOtherActive) return;

    setPulses((prev) =>
      prev.map((p) => (p.id === pulseId ? { ...p, refundedAt: new Date().toISOString() } : p)),
    );
    setVisits((prev) =>
      prev.map((v) => {
        if (v.id !== pulse.visitId) return v;
        const restored = Math.min(v.bonusTotal, v.bonusLeft + pulse.amount);
        return { ...v, bonusLeft: restored, isActiveBonus: restored > 0 };
      }),
    );
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id !== pulse.boxId) return b;
        const restored = b.activeBonusLeft + pulse.amount;
        return {
          ...b,
          activeBonusLeft: restored,
          displayText: `MUKOFOT QOLDI: ${restored.toLocaleString('fr-FR')} SO'M`,
        };
      }),
    );
  };

  const handleConfirmPending = (pendingId: number, plateInput: string) => {
    const plate = normalizePlate(plateInput);
    if (!PLATE_REGEX.test(plate)) return;
    const item = pending.find((p) => p.id === pendingId);
    if (!item) return;

    registerAutoVisitAndBonus(
      item.boxId,
      plate,
      item.agreementPct / 100,
      item.framesTaken,
      'manual_confirmed',
      'sedan',
    );
    setPending((prev) => prev.filter((p) => p.id !== pendingId));
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => uiMode === 'pro' || !item.proOnly);
  const activeNavItem = visibleNavItems.find((n) => n.key === activeTab) ?? visibleNavItems[0];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center">
          <span className="font-display font-bold text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Tomchi
          </span>
        </div>

        {/* Simple vs Professional mode segmented control */}
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleUiModeChange('simple')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                uiMode === 'simple'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {language === 'uz' ? 'Oddiy' : 'Обычный'}
            </button>
            <button
              type="button"
              onClick={() => handleUiModeChange('pro')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                uiMode === 'pro'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {language === 'uz' ? 'Professional' : 'Профи'}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item[language]}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <select
              aria-label={language === 'uz' ? 'Til' : 'Язык'}
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'ru' ? 'ru' : 'uz')}
              className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="uz">O‘zbekcha</option>
              <option value="ru">Русский</option>
            </select>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {language === 'uz'
              ? 'IP kamera · 1 FPS · 80% kelishuv'
              : 'IP-камера · 1 FPS · 80% консенсус'}
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Tomchi
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 pt-3">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => handleUiModeChange('simple')}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    uiMode === 'simple'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {language === 'uz' ? 'Oddiy' : 'Обычный'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUiModeChange('pro')}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    uiMode === 'pro'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {language === 'uz' ? 'Professional' : 'Профи'}
                </button>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item[language]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 dark:text-slate-400">Tomchi</span>
              <span className="text-slate-400" aria-hidden="true">/</span>
              <h1 className="font-display font-semibold text-slate-900 dark:text-slate-50 truncate">
                {activeNavItem[language]}
              </h1>
            </div>
          </div>

          <button
            type="button"
            disabled={boxes.length >= 20}
            onClick={handleAddBox}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {boxes.length >= 20
                ? language === 'uz'
                  ? '20/20 box to‘lgan'
                  : '20/20 боксов'
                : language === 'uz'
                  ? `Box qo‘shish (${boxes.length}/20)`
                  : `Добавить бокс (${boxes.length}/20)`}
            </span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'boxes' && (
            <BoxMonitorView
              boxes={boxes}
              language={language}
              uiMode={uiMode}
              activeCaptureBoxId={activeCaptureBoxId}
              onSimulateArrival={handleSimulateArrivalFromMonitor}
              onSimulateExit={handleSimulateExit}
              onOpenCameraConfig={(boxId) => {
                setSelectedBoxId(boxId);
                setActiveTab('anpr');
              }}
              onScaleTo20={handleScaleTo20}
            />
          )}

          {activeTab === 'anpr' && (
            <AnprPipelineView
              boxes={boxes}
              selectedBoxId={selectedBoxId}
              onSelectBox={setSelectedBoxId}
              language={language}
              runningBurst={activeCaptureBoxId !== null}
              frameLogs={frameLogs}
              lastOutcomeText={lastOutcomeText}
              onStartBurst={(boxId, preset, plate) =>
                runBurstSession(boxId, preset, plate, 'sedan')
              }
              onResetLogs={() => {
                setFrameLogs([]);
                setLastOutcomeText(null);
              }}
              onGenerateEsp32Code={handleGenerateEsp32Code}
              onSimulateEsp32Claim={handleSimulateEsp32Claim}
              onUpdateCameraConfig={handleUpdateCameraConfig}
            />
          )}

          {activeTab === 'visits' && (
            <VisitsBonusView
              language={language}
              boxes={boxes}
              visits={visits}
              pending={pending}
              pulses={pulses}
              settings={bonusSettings}
              onUpdateSettings={setBonusSettings}
              onPressBonus={handlePressBonus}
              onRefundPulse={handleRefundPulse}
              onConfirmPending={handleConfirmPending}
            />
          )}

          {activeTab === 'server' && (
            <ServerArchView language={language} currentBoxCount={boxes.length} />
          )}
        </main>
      </div>
    </div>
  );
}
