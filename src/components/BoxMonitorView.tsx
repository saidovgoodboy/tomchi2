import { Camera, CarFront, LogOut, Play, SlidersHorizontal } from 'lucide-react';
import { BAY_IMAGES } from '../data/initialData';
import type { BoxOccupancyState, Language, UiMode, VehiclePreset, WashBox } from '../types';

interface BoxMonitorViewProps {
  boxes: WashBox[];
  language: Language;
  uiMode: UiMode;
  activeCaptureBoxId: string | null;
  onSimulateArrival: (boxId: string, preset: VehiclePreset) => void;
  onSimulateExit: (boxId: string) => void;
  onOpenCameraConfig: (boxId: string) => void;
  onScaleTo20: () => void;
}

const STATE_LABELS: Record<BoxOccupancyState, { uz: string; ru: string; tone: string }> = {
  empty: {
    uz: 'Bo‘sh',
    ru: 'Свободен',
    tone: 'text-slate-600 dark:text-slate-400',
  },
  confirming_arrival: {
    uz: 'Kirish tekshirilmoqda',
    ru: 'Проверка въезда',
    tone: 'text-amber-700 dark:text-amber-400',
  },
  capturing: {
    uz: '1 FPS kadr olinmoqda',
    ru: 'Съёмка 1 FPS',
    tone: 'text-sky-700 dark:text-sky-400',
  },
  occupied: {
    uz: 'Band',
    ru: 'Занят',
    tone: 'text-emerald-700 dark:text-emerald-400',
  },
  confirming_exit: {
    uz: 'Chiqish kutilmoqda',
    ru: 'Проверка выезда',
    tone: 'text-amber-700 dark:text-amber-400',
  },
};

export function BoxMonitorView({
  boxes,
  language,
  uiMode,
  activeCaptureBoxId,
  onSimulateArrival,
  onSimulateExit,
  onOpenCameraConfig,
  onScaleTo20,
}: BoxMonitorViewProps) {
  const occupiedCount = boxes.filter((b) => b.state === 'occupied' || b.state === 'capturing').length;
  const activeBonusBox = boxes.find((b) => b.activeBonusLeft > 0);
  const subStreamMbps = (boxes.length * 0.35).toFixed(1);
  const isPro = uiMode === 'pro';

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isPro ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'uz' ? 'Jami boxlar (3–20)' : 'Всего боксов (3–20)'}
          </p>
          <p className="mt-1.5 text-2xl font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {boxes.length} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ 20</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'uz' ? 'Band / Aniqlanmoqda' : 'Занято / В процессе'}
          </p>
          <p className="mt-1.5 text-2xl font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {occupiedCount}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              {language === 'uz' ? 'ta box' : 'боксов'}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'uz' ? 'Faol bonus (bitta boxda)' : 'Активный бонус (в одном боксе)'}
          </p>
          <p className="mt-1.5 text-2xl font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {activeBonusBox ? `${activeBonusBox.activeBonusLeft.toLocaleString('fr-FR')} so'm` : '0 so‘m'}
          </p>
          {activeBonusBox && (
            <p className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
              {activeBonusBox.name} · {activeBonusBox.currentPlate}
            </p>
          )}
        </div>

        {isPro && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz' ? 'Sub-stream tarmoq yuki' : 'Нагрузка sub-stream'}
              </p>
              <p className="mt-1.5 text-2xl font-display font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {subStreamMbps} Mbps
              </p>
            </div>
            {boxes.length < 20 && (
              <button
                type="button"
                onClick={onScaleTo20}
                className="mt-2 self-start text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
              >
                {language === 'uz' ? '20 ta box rejimi bilan ko‘rish' : 'Показать масштаб на 20 боксов'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {boxes.map((box, index) => {
          const stateMeta = STATE_LABELS[box.state];
          const imageSrc =
            box.vehicleVisual === 'sedan'
              ? BAY_IMAGES.sedan
              : box.vehicleVisual === 'suv'
                ? BAY_IMAGES.suv
                : BAY_IMAGES.empty;
          const presetForArrival: VehiclePreset = index % 2 === 0 ? 'sedan' : 'suv';
          const isCapturing = box.state === 'capturing' || activeCaptureBoxId === box.id;

          return (
            <article
              key={box.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-50 truncate">
                    {box.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`font-medium ${stateMeta.tone}`}>{stateMeta[language]}</span>
                    {isPro && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">ROI {Math.round(box.occupancyScore * 100)}%</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {box.esp32Paired
                            ? language === 'uz'
                              ? 'P10 ulangan'
                              : 'P10 подключён'
                            : language === 'uz'
                              ? 'P10 ulanmagan'
                              : 'P10 не подключён'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {isPro && (
                  <button
                    type="button"
                    onClick={() => onOpenCameraConfig(box.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{language === 'uz' ? 'Sozlash' : 'Настроить'}</span>
                  </button>
                )}
              </div>

              <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                <img
                  src={imageSrc}
                  alt={`${box.name} IP kamera ko'rinishi`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35 pointer-events-none" />

                {isPro && (
                  <>
                    <div
                      className="absolute border border-dashed border-sky-400/90 pointer-events-none"
                      style={{
                        left: `${box.roi.x * 100}%`,
                        top: `${box.roi.y * 100}%`,
                        width: `${box.roi.w * 100}%`,
                        height: `${box.roi.h * 100}%`,
                      }}
                    >
                      <span className="bg-slate-950/80 text-sky-300 font-mono text-[10px] px-1.5 py-0.5 inline-block">
                        ROI · 320x240 @ 2 FPS
                      </span>
                    </div>

                    <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-100">
                      <span>{box.cameraIp}</span>
                      <span>
                        {box.state === 'capturing'
                          ? 'MAIN 1080p · 1 FPS'
                          : 'SUB 360p · 2 FPS'}
                      </span>
                    </div>
                  </>
                )}

                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2 text-xs text-slate-100">
                  <div className="font-mono">
                    {box.currentPlate ? (
                      <span className="font-semibold tracking-wider text-sm">{box.currentPlate}</span>
                    ) : (
                      <span className="text-slate-300">
                        {language === 'uz' ? 'Avtomobil kutilmoqda' : 'Ожидание авто'}
                      </span>
                    )}
                  </div>
                  {isPro && box.lastAgreement !== null && (
                    <span className="font-mono tabular-nums text-[11px] text-slate-200">
                      {Math.round(box.lastAgreement * 100)}% ({box.lastCaptureStatus})
                    </span>
                  )}
                </div>
              </div>

              {/* P10 panel LED preview */}
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 shrink-0">P10</span>
                <p
                  className={`font-mono text-xs truncate ${
                    box.activeBonusLeft > 0 ? 'text-amber-400' : 'text-cyan-300'
                  }`}
                  title={box.displayText}
                >
                  {box.displayText}
                </p>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                {box.state === 'empty' ? (
                  <button
                    type="button"
                    disabled={isCapturing}
                    onClick={() => onSimulateArrival(box.id, presetForArrival)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {language === 'uz' ? 'Mashina kirishini sinash' : 'Тест въезда авто'}
                    </span>
                  </button>
                ) : box.state === 'occupied' ? (
                  <button
                    type="button"
                    onClick={() => onSimulateExit(box.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{language === 'uz' ? 'Mashina chiqdi' : 'Авто выехало'}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400">
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {language === 'uz'
                        ? '5+ kadr (80%) tahlil qilinmoqda…'
                        : 'Идёт анализ 5+ кадров (80%)…'}
                    </span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  <CarFront className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {box.activeBonusLeft > 0
                      ? `${box.activeBonusLeft.toLocaleString('fr-FR')} so'm`
                      : language === 'uz'
                        ? 'Bonus 0'
                        : 'Бонус 0'}
                  </span>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
