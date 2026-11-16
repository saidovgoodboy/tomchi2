import { Check, RotateCcw, Search, Zap } from 'lucide-react';
import { useState } from 'react';
import type {
  BonusPulseRecord,
  BonusSettings,
  Language,
  PendingDetection,
  VisitRecord,
  WashBox,
} from '../types';

interface VisitsBonusViewProps {
  language: Language;
  boxes: WashBox[];
  visits: VisitRecord[];
  pending: PendingDetection[];
  pulses: BonusPulseRecord[];
  settings: BonusSettings;
  onUpdateSettings: (next: BonusSettings) => void;
  onPressBonus: (boxId: string) => void;
  onRefundPulse: (pulseId: number) => void;
  onConfirmPending: (pendingId: number, plate: string) => void;
}

export function VisitsBonusView({
  language,
  boxes,
  visits,
  pending,
  pulses,
  settings,
  onUpdateSettings,
  onPressBonus,
  onRefundPulse,
  onConfirmPending,
}: VisitsBonusViewProps) {
  const [search, setSearch] = useState('');
  const [pendingPlates, setPendingPlates] = useState<Record<number, string>>({});
  const [draftSettings, setDraftSettings] = useState<BonusSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const filteredVisits = visits.filter((v) =>
    v.plate.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const activeBonusBox = boxes.find((b) => b.activeBonusLeft > 0);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draftSettings);
    setSettingsSaved(true);
    window.setTimeout(() => setSettingsSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Pending review queue (when 15 frames didn't reach 80%) */}
      {pending.length > 0 && (
        <section className="rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div>
            <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-50">
              {language === 'uz'
                ? '80% ga yetmagan aniqlashlar (Pending)'
                : 'Ожидающие подтверждения (< 80%)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'uz'
                ? '15 ta kadrda 80% kelishuv bo‘lmagan holatlar — raqamni tekshirib tasdiqlang.'
                : 'За 15 кадров не набрано 80% — проверьте номер и подтвердите.'}
            </p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {pending.map((item) => {
              const value = pendingPlates[item.id] ?? item.suggestedPlate ?? '';
              return (
                <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.imageUrl}
                      alt={`${item.boxId} kutilayotgan surat`}
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 object-cover rounded border border-slate-200 dark:border-slate-700"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.boxId} · {item.votes}/{item.framesTaken} ({item.agreementPct}%)
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {item.createdAt.replace('T', ' ').slice(0, 19)} UTC
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setPendingPlates((prev) => ({
                          ...prev,
                          [item.id]: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="01A123BC"
                      className="w-32 px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => onConfirmPending(item.id, value)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{language === 'uz' ? 'Tasdiqlash' : 'Подтвердить'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visits table */}
        <section className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-50">
                {language === 'uz' ? 'Kelishlar tarixi' : 'История визитов'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz'
                  ? 'Har bir 80% tasdiqlangan kirish avtomatik kelish va bonus qoidasini ishga tushiradi.'
                  : 'Каждый подтверждённый на 80% въезд автоматически регистрирует визит и бонус.'}
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'uz' ? 'Raqam qidirish…' : 'Поиск номера…'}
                className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-medium">{language === 'uz' ? 'Raqam' : 'Номер'}</th>
                  <th className="py-2.5 px-3 font-medium">Box</th>
                  <th className="py-2.5 px-3 font-medium text-right">{language === 'uz' ? 'Kelish' : 'Визит'}</th>
                  <th className="py-2.5 px-3 font-medium text-right">ANPR</th>
                  <th className="py-2.5 px-3 font-medium text-right">{language === 'uz' ? 'Qolgan bonus' : 'Остаток'}</th>
                  <th className="py-2.5 px-3 font-medium">{language === 'uz' ? 'Holat' : 'Статус'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-3 text-center text-slate-500 dark:text-slate-400">
                      {language === 'uz' ? 'Kelishlar topilmadi.' : 'Визиты не найдены.'}
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {visit.plate}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {visit.boxId}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700 dark:text-slate-200">
                        #{visit.visitNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-500 dark:text-slate-400">
                        {visit.agreementPct !== null ? `${visit.agreementPct}% (${visit.framesUsed}f)` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-900 dark:text-slate-100">
                        {visit.bonusLeft.toLocaleString('fr-FR')} so'm
                      </td>
                      <td className="py-2.5 px-3">
                        {visit.isActiveBonus ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {language === 'uz' ? 'Faol bonus' : 'Активный бонус'}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {visit.bonusTotal > 0
                              ? language === 'uz'
                                ? 'Sarflangan / tugagan'
                                : 'Использован'
                              : language === 'uz'
                                ? 'Oddiy kelish'
                                : 'Обычный визит'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: Bonus settings + P10 button press & pulse refund */}
        <section className="lg:col-span-4 space-y-5">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-display font-semibold text-slate-900 dark:text-slate-50">
              {language === 'uz' ? 'Bonus qoidalari' : 'Правила бонусов'}
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <label className="block">
                <span className="text-slate-600 dark:text-slate-300">
                  {language === 'uz' ? 'Bonus summasi (so‘m)' : 'Сумма бонуса (сум)'}
                </span>
                <input
                  type="number"
                  step={1000}
                  min={1000}
                  value={draftSettings.bonusAmount}
                  onChange={(e) =>
                    setDraftSettings((s) => ({ ...s, bonusAmount: Number(e.target.value) || 1000 }))
                  }
                  className="mt-1 w-full px-2.5 py-2 font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-slate-600 dark:text-slate-300">
                  {language === 'uz' ? 'Bir bosishda yechiladi (so‘m)' : 'За одно нажатие (сум)'}
                </span>
                <input
                  type="number"
                  step={1000}
                  min={1000}
                  value={draftSettings.bonusPerPress}
                  onChange={(e) =>
                    setDraftSettings((s) => ({ ...s, bonusPerPress: Number(e.target.value) || 1000 }))
                  }
                  className="mt-1 w-full px-2.5 py-2 font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-slate-600 dark:text-slate-300">
                  {language === 'uz' ? 'Har necha kelishda bonus' : 'Бонус каждые N визитов'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={draftSettings.bonusEveryVisits}
                  onChange={(e) =>
                    setDraftSettings((s) => ({
                      ...s,
                      bonusEveryVisits: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="mt-1 w-full px-2.5 py-2 font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-md bg-slate-900 dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-700 transition-colors whitespace-nowrap"
                >
                  {language === 'uz' ? 'Saqlash' : 'Сохранить'}
                </button>
                {settingsSaved && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    {language === 'uz' ? 'Saqlandi' : 'Сохранено'}
                  </span>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-base font-display font-semibold text-slate-900 dark:text-slate-50">
              {language === 'uz' ? 'P10 Panel tugmasi va impulslar' : 'Кнопка P10 и импульсы'}
            </h3>
            {activeBonusBox ? (
              <div className="space-y-2.5 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  {activeBonusBox.name} ·{' '}
                  <span className="font-mono font-semibold">{activeBonusBox.currentPlate}</span> ·{' '}
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {activeBonusBox.activeBonusLeft.toLocaleString('fr-FR')} so'm
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => onPressBonus(activeBonusBox.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {language === 'uz'
                      ? `Tugmani bosish (-${settings.bonusPerPress.toLocaleString('fr-FR')} so'm)`
                      : `Нажать кнопку (-${settings.bonusPerPress.toLocaleString('fr-FR')} сум)`}
                  </span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz'
                  ? 'Hozir faol bonus yo‘q. Kelishlar soni intervalga yetganda avtomatik faollashadi.'
                  : 'Нет активного бонуса. Активируется автоматически при кратном визите.'}
              </p>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {language === 'uz' ? 'So‘nggi impulslar' : 'Последние импульсы'}
              </p>
              {pulses.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'uz' ? 'Impulslar yo‘q' : 'Импульсов нет'}
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pulses.slice(0, 5).map((pulse) => (
                    <div key={pulse.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-mono text-slate-900 dark:text-slate-100 truncate">
                          {pulse.plate} · {pulse.amount.toLocaleString('fr-FR')} so'm
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {pulse.boxId} · {pulse.pressId}
                        </p>
                      </div>
                      {pulse.refundedAt ? (
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">
                          {language === 'uz' ? 'Qaytarilgan' : 'Возвращён'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRefundPulse(pulse.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" aria-hidden="true" />
                          <span>{language === 'uz' ? 'Qaytarish' : 'Вернуть'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
