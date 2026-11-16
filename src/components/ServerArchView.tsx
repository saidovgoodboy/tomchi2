import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { PYTHON_BACKEND_FILES } from '../data/pythonBackendDocs';
import type { Language } from '../types';

interface ServerArchViewProps {
  language: Language;
  currentBoxCount: number;
}

export function ServerArchView({ language, currentBoxCount }: ServerArchViewProps) {
  const [boxCount, setBoxCount] = useState(Math.max(3, Math.min(20, currentBoxCount)));
  const [subFps, setSubFps] = useState(2);
  const [subQuality, setSubQuality] = useState<'360p' | '480p'>('360p');
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const subBitrateMbpsPerCam = subQuality === '360p' ? (subFps <= 2 ? 0.35 : 0.6) : subFps <= 2 ? 0.65 : 1.0;
  const totalSubMbps = (boxCount * subBitrateMbpsPerCam).toFixed(1);
  // Assuming at most 2-3 boxes capturing simultaneously at 1 FPS JPEG / main stream
  const burstMbps = (Math.min(boxCount, 3) * 4.5).toFixed(1);
  const totalNetworkMbps = (Number(totalSubMbps) + Number(burstMbps)).toFixed(1);
  const rx580VaapiLoadPct = Math.min(95, Math.round(boxCount * (subQuality === '360p' ? 2.2 : 3.4)));
  const ramMb = Math.round(650 + boxCount * 65);

  const activeFile = PYTHON_BACKEND_FILES[activeFileIndex];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked in iframe
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Linux + RX 580 Resource & Camera Sizing Calculator */}
        <section className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div>
            <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-50">
              {language === 'uz'
                ? 'Linux + RX 580 resurs kalkulyatori (3–20 box)'
                : 'Калькулятор ресурсов Linux + RX 580 (3–20 боксов)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'uz'
                ? 'Doimiy kuzatuv faqat sub-stream da; yuqori oqim faqat mashina kirganda 1 FPS da ishlaydi.'
                : 'Постоянный мониторинг только на sub-stream; высокий поток запускается на 1 FPS при въезде.'}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <label className="block">
              <div className="flex justify-between mb-1">
                <span className="text-slate-600 dark:text-slate-300">
                  {language === 'uz' ? 'Boxlar soni' : 'Количество боксов'}
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {boxCount} ta
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={20}
                value={boxCount}
                onChange={(e) => setBoxCount(Number(e.target.value))}
                className="w-full"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">
                {language === 'uz' ? 'Sub-stream sifati' : 'Качество sub-stream'}
              </span>
              <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                {(['360p', '480p'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSubQuality(q)}
                    className={`px-2.5 py-1 text-xs font-mono rounded ${
                      subQuality === q
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">
                {language === 'uz' ? 'Holat tekshirish tezligi' : 'Частота проверки бокса'}
              </span>
              <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800">
                {[2, 4].map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    onClick={() => setSubFps(fps)}
                    className={`px-2.5 py-1 text-xs font-mono rounded ${
                      subFps === fps
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz' ? 'Tarmoq (1 Gbps PoE)' : 'Сеть (1 Gbps PoE)'}
              </p>
              <p className="mt-1 text-lg font-display font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                ~{totalNetworkMbps} Mbps
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">RX 580 VA-API decode</p>
              <p className="mt-1 text-lg font-display font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                ~{rx580VaapiLoadPct}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz' ? 'Server RAM' : 'ОЗУ сервера'}
              </p>
              <p className="mt-1 text-lg font-display font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                ~{(ramMb / 1024).toFixed(1)} GB
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'uz' ? 'Tavsiya CPU' : 'Рекомендуемый CPU'}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">
                {boxCount <= 8 ? 'i3 / Ryzen 3 (4 yadro)' : 'i5 / Ryzen 5 (6+ yadro)'}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {language === 'uz'
                ? 'Sotib olinadigan IP kamera talablari:'
                : 'Требования к покупаемой IP-камере:'}
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                {language === 'uz'
                  ? 'Dual-stream RTSP (H.264): Sub-stream (360p/480p) + Main-stream (2MP/4MP 1080p+).'
                  : 'Dual-stream RTSP (H.264): Sub-stream (360p/480p) + Main-stream (1080p+).'}
              </li>
              <li>
                {language === 'uz'
                  ? 'HTTP Snapshot URL (ISAPI/CGI) qo‘llashi — har 1 soniyada kadr olishni juda tezlashtiradi.'
                  : 'Поддержка HTTP Snapshot URL — ускоряет захват 1 кадра в секунду.'}
              </li>
              <li>
                {language === 'uz'
                  ? 'IP67 namlikdan himoya, WDR (yorug‘lik qarshisida raqam ko‘rinishi) va varifokal yoki 4mm/6mm obyektiv.'
                  : 'Защита IP67, аппаратный WDR против бликов воды и объектив 4mm/6mm.'}
              </li>
              <li>
                {language === 'uz'
                  ? 'RX 580 (Polaris) Linuxda Mesa VA-API (/dev/dri/renderD128) orqali FFmpeg dekodlashni ko‘taradi; ANPR uchun ONNX + OpenCL/CPU ishlatiladi (modern ROCm Polaris’ni qo‘llamaydi).'
                  : 'RX 580 (Polaris) на Linux использует Mesa VA-API (/dev/dri/renderD128) для FFmpeg; ANPR работает через ONNX/CPU + OpenCL.'}
              </li>
            </ul>
          </div>
        </section>

        {/* Right: Tested Python Backend Code Viewer */}
        <section className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-50">
                {language === 'uz'
                  ? 'Tomchi Python Backend (yangi modullar)'
                  : 'Tomchi Python Backend (новые модули)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'uz'
                  ? 'Loyiha papkasidagi tomchi_backend_ipcam/ ichida saqlangan va unittest bilan tekshirilgan.'
                  : 'Сохранено в tomchi_backend_ipcam/ и проверено через unittest.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (language === 'uz' ? 'Nusxalandi' : 'Скопировано') : (language === 'uz' ? 'Nusxa olish' : 'Копировать')}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800">
            {PYTHON_BACKEND_FILES.map((file, idx) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setActiveFileIndex(idx)}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                  activeFileIndex === idx
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {file.filename.split('/').pop()}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            {language === 'uz' ? activeFile.summaryUz : activeFile.summaryRu}
          </p>

          <pre className="rounded-md bg-slate-950 text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
            <code>{activeFile.code}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
