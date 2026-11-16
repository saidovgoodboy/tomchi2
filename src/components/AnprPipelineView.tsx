import { CheckCircle2, KeyRound, Play, RotateCcw, Save, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { BAY_IMAGES } from '../data/initialData';
import type { CameraBrand, CaptureFrameLog, Language, NormalizedROI, WashBox } from '../types';

export type BurstPresetKey = 'consensus_5_5' | 'consensus_4_5' | 'mixed_pending' | 'empty_abort';

interface AnprPipelineViewProps {
  boxes: WashBox[];
  selectedBoxId: string;
  onSelectBox: (boxId: string) => void;
  language: Language;
  runningBurst: boolean;
  frameLogs: CaptureFrameLog[];
  lastOutcomeText: string | null;
  onStartBurst: (boxId: string, preset: BurstPresetKey, customPlate: string) => void;
  onResetLogs: () => void;
  onGenerateEsp32Code: (boxId: string) => void;
  onSimulateEsp32Claim: (boxId: string) => void;
  onUpdateCameraConfig: (
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
  ) => void;
}

export function AnprPipelineView({
  boxes,
  selectedBoxId,
  onSelectBox,
  language,
  runningBurst,
  frameLogs,
  lastOutcomeText,
  onStartBurst,
  onResetLogs,
  onGenerateEsp32Code,
  onSimulateEsp32Claim,
  onUpdateCameraConfig,
}: AnprPipelineViewProps) {
  const box = boxes.find((b) => b.id === selectedBoxId) ?? boxes[0];
  const [preset, setPreset] = useState<BurstPresetKey>('consensus_4_5');
  const [customPlate, setCustomPlate] = useState('01A888BC');

  const [brand, setBrand] = useState<CameraBrand>(box.cameraBrand);
  const [camIp, setCamIp] = useState(box.cameraIp);
  const [camUser, setCamUser] = useState('admin');
  const [camPass, setCamPass] = useState('pass');
  const [lowUrl, setLowUrl] = useState(box.lowStreamUrl);
  const [highUrl, setHighUrl] = useState(box.highStreamUrl);
  const [snapUrl, setSnapUrl] = useState(box.snapshotUrl);
  const [useVaapi, setUseVaapi] = useState(box.useVaapi);
  const [roi, setRoi] = useState<NormalizedROI>(box.roi);
  const [savedNotice, setSavedNotice] = useState(false);

  const buildTemplates = (nextBrand: CameraBrand, ip: string, user: string, pass: string) => {
    const cleanIp = ip.trim() || '192.168.1.101';
    const auth = user.trim() ? `${encodeURIComponent(user.trim())}:${encodeURIComponent(pass)}@` : '';
    if (nextBrand === 'hikvision') {
      return {
        low: `rtsp://${auth}${cleanIp}:554/Streaming/Channels/102`,
        high: `rtsp://${auth}${cleanIp}:554/Streaming/Channels/101`,
        snap: `http://${auth}${cleanIp}:80/ISAPI/Streaming/channels/101/picture`,
      };
    }
    if (nextBrand === 'dahua') {
      return {
        low: `rtsp://${auth}${cleanIp}:554/cam/realmonitor?channel=1&subtype=1`,
        high: `rtsp://${auth}${cleanIp}:554/cam/realmonitor?channel=1&subtype=0`,
        snap: `http://${auth}${cleanIp}:80/cgi-bin/snapshot.cgi?channel=1`,
      };
    }
    if (nextBrand === 'uniview') {
      return {
        low: `rtsp://${auth}${cleanIp}:554/unicast/c1/s1/live`,
        high: `rtsp://${auth}${cleanIp}:554/unicast/c1/s0/live`,
        snap: `http://${auth}${cleanIp}:80/LAPI/V1.0/Channels/0/Media/Video/Streams/0/Snapshot`,
      };
    }
    return {
      low: `rtsp://${auth}${cleanIp}:554/stream2`,
      high: `rtsp://${auth}${cleanIp}:554/stream1`,
      snap: '',
    };
  };

  const applyQuickTemplates = (nextBrand = brand, nextIp = camIp, nextUser = camUser, nextPass = camPass) => {
    const urls = buildTemplates(nextBrand, nextIp, nextUser, nextPass);
    setLowUrl(urls.low);
    setHighUrl(urls.high);
    setSnapUrl(urls.snap);
  };

  const handleBoxChange = (nextId: string) => {
    onSelectBox(nextId);
    const next = boxes.find((b) => b.id === nextId);
    if (next) {
      setBrand(next.cameraBrand);
      setCamIp(next.cameraIp);
      setLowUrl(next.lowStreamUrl);
      setHighUrl(next.highStreamUrl);
      setSnapUrl(next.snapshotUrl);
      setUseVaapi(next.useVaapi);
      setRoi(next.roi);
      setSavedNotice(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCameraConfig(box.id, {
      cameraBrand: brand,
      cameraIp: camIp.trim() || box.cameraIp,
      lowStreamUrl: lowUrl.trim(),
      highStreamUrl: highUrl.trim(),
      snapshotUrl: snapUrl.trim(),
      useVaapi,
      roi,
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const previewImg =
    box.vehicleVisual === 'sedan'
      ? BAY_IMAGES.sedan
      : box.vehicleVisual === 'suv'
        ? BAY_IMAGES.suv
        : BAY_IMAGES.empty;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: 1-FPS CaptureSession Live Runner */}
      <section className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-50">
              {language === 'uz'
                ? '1 FPS yuqori sifatli ANPR va 80% qaror mashinasi'
                : '1 FPS ANPR высокого качества и консенсус 80%'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'uz'
                ? 'Kamida 5 ta kadr (har soniyada 1 ta) · So‘nggi 5 kadrda >= 80% bir xil raqam bo‘lsa avtomatik Visit + Bonus'
                : 'Минимум 5 кадров (1 кадр/с) · При >= 80% совпадении за окно 5 кадров создаётся визит и бонус'}
            </p>
          </div>
          <select
            aria-label={language === 'uz' ? 'Box tanlash' : 'Выбрать бокс'}
            value={box.id}
            onChange={(e) => handleBoxChange(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            {boxes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.id})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            {(
              [
                {
                  key: 'consensus_4_5',
                  uz: '4/5 (80%) — 1 ta xira kadr',
                  ru: '4/5 (80%) — 1 смаз',
                },
                {
                  key: 'consensus_5_5',
                  uz: '5/5 (100%) — Toza seriya',
                  ru: '5/5 (100%) — Чистая серия',
                },
                {
                  key: 'mixed_pending',
                  uz: 'Aralash — 15 kadr -> Pending',
                  ru: 'Смешанный — 15 кадр. -> Pending',
                },
                {
                  key: 'empty_abort',
                  uz: '5x Bo‘sh — Bekor (Aborted)',
                  ru: '5x Пусто — Отмена (Aborted)',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPreset(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  preset === opt.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt[language]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span>{language === 'uz' ? 'Raqam:' : 'Номер:'}</span>
              <input
                type="text"
                value={customPlate}
                onChange={(e) => setCustomPlate(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-32 px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </label>

            <button
              type="button"
              disabled={runningBurst}
              onClick={() => onStartBurst(box.id, preset, customPlate)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {runningBurst
                  ? language === 'uz'
                    ? 'Kadrlar olinmoqda (1 FPS)…'
                    : 'Идёт съёмка (1 FPS)…'
                  : language === 'uz'
                    ? '1 FPS CaptureSession boshlash'
                    : 'Запустить CaptureSession (1 FPS)'}
              </span>
            </button>

            {frameLogs.length > 0 && (
              <button
                type="button"
                disabled={runningBurst}
                onClick={onResetLogs}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{language === 'uz' ? 'Tozalash' : 'Очистить'}</span>
              </button>
            )}
          </div>
        </div>

        {lastOutcomeText && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100">
            {lastOutcomeText}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-medium">#</th>
                <th className="py-2.5 px-3 font-medium">{language === 'uz' ? 'Vaqt' : 'Время'}</th>
                <th className="py-2.5 px-3 font-medium">{language === 'uz' ? 'OCR nomzod' : 'OCR'}</th>
                <th className="py-2.5 px-3 font-medium text-right">{language === 'uz' ? 'Ishonch' : 'Увер.'}</th>
                <th className="py-2.5 px-3 font-medium text-right">{language === 'uz' ? 'Oyna (5)' : 'Окно (5)'}</th>
                <th className="py-2.5 px-3 font-medium">{language === 'uz' ? 'Qaror' : 'Решение'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {frameLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-3 text-center text-slate-500 dark:text-slate-400">
                    {language === 'uz'
                      ? 'Ssenariyni tanlab «CaptureSession boshlash» tugmasini bosing.'
                      : 'Выберите сценарий и нажмите «Запустить CaptureSession».'}
                  </td>
                </tr>
              ) : (
                frameLogs.map((row) => (
                  <tr key={row.frameIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {row.frameIndex}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {row.timestamp}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {row.plate ?? '— (topilmadi)'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-600 dark:text-slate-300">
                      {row.plate ? `${Math.round(row.confidence * 100)}%` : '0%'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-700 dark:text-slate-200">
                      {row.windowVotes}/{row.windowLength} ({Math.round(row.agreement * 100)}%)
                    </td>
                    <td className="py-2 px-3 font-medium">
                      {row.decisionStatus === 'finalized' && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          finalized · Visit + Bonus
                        </span>
                      )}
                      {row.decisionStatus === 'pending' && (
                        <span className="text-amber-700 dark:text-amber-400">
                          pending · Admin tasdiqlashi
                        </span>
                      )}
                      {row.decisionStatus === 'aborted' && (
                        <span className="text-rose-700 dark:text-rose-400">
                          aborted · Soxta harakat
                        </span>
                      )}
                      {row.decisionStatus === 'continue' && (
                        <span className="text-slate-500 dark:text-slate-400">continue</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Right: IP Camera Dual-Stream & ROI Configuration */}
      <section className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h3 className="text-base font-display font-semibold text-slate-900 dark:text-slate-50">
            {language === 'uz' ? `${box.name} · IP Kamera va ROI` : `${box.name} · IP-камера и ROI`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'uz'
              ? 'Past oqim box holatini kuzatadi; yuqori oqim faqat mashina kirganda 1 FPS da ochiladi.'
              : 'Нижний поток отслеживает бокс; верхний поток открывается на 1 FPS при въезде.'}
          </p>
        </div>

        <div className="relative aspect-[4/3] rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
          <img
            src={previewImg}
            alt={`${box.name} ROI sozlash`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute border-2 border-sky-400 bg-sky-500/10 pointer-events-none"
            style={{
              left: `${roi.x * 100}%`,
              top: `${roi.y * 100}%`,
              width: `${roi.w * 100}%`,
              height: `${roi.h * 100}%`,
            }}
          />
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
          {/* Quick Camera Connect (No manual RTSP URL typing needed) */}
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {language === 'uz' ? 'Tezkor kamera ulash (IP + Brend)' : 'Быстрое подключение камеры'}
              </span>
              <button
                type="button"
                onClick={() => applyQuickTemplates()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
              >
                <Wand2 className="w-3 h-3" aria-hidden="true" />
                <span>{language === 'uz' ? 'URL yasash' : 'Сгенерировать URL'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={brand}
                onChange={(e) => {
                  const b = e.target.value as CameraBrand;
                  setBrand(b);
                  applyQuickTemplates(b, camIp, camUser, camPass);
                }}
                className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="hikvision">Hikvision</option>
                <option value="dahua">Dahua</option>
                <option value="uniview">Uniview</option>
                <option value="onvif_generic">Generic ONVIF</option>
              </select>
              <input
                type="text"
                value={camIp}
                onChange={(e) => setCamIp(e.target.value)}
                placeholder="192.168.1.101"
                className="px-2 py-1.5 font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={camUser}
                onChange={(e) => setCamUser(e.target.value)}
                placeholder="admin"
                className="px-2 py-1.5 font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <input
                type="password"
                value={camPass}
                onChange={(e) => setCamPass(e.target.value)}
                placeholder="parol"
                className="px-2 py-1.5 font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 mb-1">
              {language === 'uz' ? 'Past sifatli oqim (Sub-stream RTSP)' : 'Низкий поток (Sub-stream RTSP)'}
            </label>
            <input
              type="text"
              value={lowUrl}
              onChange={(e) => setLowUrl(e.target.value)}
              className="w-full px-2.5 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 mb-1">
              {language === 'uz' ? 'Yuqori sifatli oqim (Main-stream RTSP)' : 'Высокий поток (Main-stream RTSP)'}
            </label>
            <input
              type="text"
              value={highUrl}
              onChange={(e) => setHighUrl(e.target.value)}
              className="w-full px-2.5 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-300 mb-1">
              {language === 'uz' ? 'HTTP Snapshot URL (ixtiyoriy, tezkor)' : 'HTTP Snapshot URL (опционально)'}
            </label>
            <input
              type="text"
              value={snapUrl}
              onChange={(e) => setSnapUrl(e.target.value)}
              className="w-full px-2.5 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">ROI X ({Math.round(roi.x * 100)}%)</span>
              <input
                type="range"
                min={5}
                max={50}
                value={Math.round(roi.x * 100)}
                onChange={(e) => setRoi({ ...roi, x: Number(e.target.value) / 100 })}
                className="w-full mt-1"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">ROI Y ({Math.round(roi.y * 100)}%)</span>
              <input
                type="range"
                min={5}
                max={55}
                value={Math.round(roi.y * 100)}
                onChange={(e) => setRoi({ ...roi, y: Number(e.target.value) / 100 })}
                className="w-full mt-1"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">ROI W ({Math.round(roi.w * 100)}%)</span>
              <input
                type="range"
                min={25}
                max={90}
                value={Math.round(roi.w * 100)}
                onChange={(e) => setRoi({ ...roi, w: Number(e.target.value) / 100 })}
                className="w-full mt-1"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">ROI H ({Math.round(roi.h * 100)}%)</span>
              <input
                type="range"
                min={25}
                max={90}
                value={Math.round(roi.h * 100)}
                onChange={(e) => setRoi({ ...roi, h: Number(e.target.value) / 100 })}
                className="w-full mt-1"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 pt-1 text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={useVaapi}
              onChange={(e) => setUseVaapi(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700"
            />
            <span>
              {language === 'uz'
                ? 'AMD RX 580 VA-API apparat dekodlash (/dev/dri/renderD128)'
                : 'Аппаратное декодирование AMD RX 580 VA-API'}
            </span>
          </label>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-slate-900 dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{language === 'uz' ? 'Saqlash' : 'Сохранить'}</span>
            </button>
            {savedNotice && (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {language === 'uz' ? 'Saqlandi' : 'Сохранено'}
              </span>
            )}
          </div>
        </form>

        {/* Zero-Config ESP32 (P10 + Impuls) Pairing */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {language === 'uz'
                ? 'ESP32 (P10 + Impuls) oson ulash'
                : 'Подключение ESP32 (P10 + Импульс)'}
            </span>
            {box.esp32Paired ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{language === 'uz' ? 'Ulangan' : 'Подключён'}</span>
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {language === 'uz' ? 'Ulanmagan' : 'Не подключён'}
              </span>
            )}
          </div>

          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            {language === 'uz'
              ? 'Bitta universal proshivkali ESP32 ni yoqqanda Tomchi-Setup Wi-Fi ochiladi; shu yerda yaratilgan 6 xonali kod kiritilsa box_id va device_key avtomatik yuklanadi.'
              : 'ESP32 с универсальной прошивкой открывает Wi-Fi Tomchi-Setup; ввод 6-значного кода автоматически загружает box_id и device_key.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onGenerateEsp32Code(box.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{language === 'uz' ? '6 xonali kod olish' : 'Получить 6-значный код'}</span>
            </button>

            {box.pairingCode && (
              <>
                <span className="font-mono font-semibold text-sm tracking-widest text-sky-700 dark:text-sky-300 px-2">
                  {box.pairingCode}
                </span>
                <button
                  type="button"
                  onClick={() => onSimulateEsp32Claim(box.id)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 whitespace-nowrap"
                >
                  {language === 'uz' ? 'ESP32 ulashni yakunlash' : 'Завершить привязку'}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
