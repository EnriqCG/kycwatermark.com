import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

type WatermarkSettings = {
  text: string;
  angle: number;
  opacity: number;
  fontSize: number;
  spacingX: number;
  spacingY: number;
  color: string;
  grayscale: boolean;
  offsetX: number;
  offsetY: number;
  lineGap: number;
  stagger: number;
};

type Preset = {
  title: string;
  description: string;
  hint: string;
  initialSettings: WatermarkSettings;
  downloadName: string;
};

const watermarkPreset: Preset = {
  title: 'Watermark',
  description:
    'Greyscale if needed and add a repeating diagonal watermark that keeps ID details readable while binding the image to a single purpose.',
  hint: 'Use subdued opacity for legibility. Adjust offsets if the text sits on faces or stamps.',
  downloadName: 'watermarked.png',
  initialSettings: {
    text: 'KYC for booking on dates XYZ',
    angle: -32,
    opacity: 0.14,
    fontSize: 34,
    spacingX: 180,
    spacingY: 180,
    color: '#0f172a',
    grayscale: true,
    offsetX: 0,
    offsetY: 0,
    lineGap: 12,
    stagger: 0
  }
};

function App() {
  return (
    <div className="max-w-6xl mx-auto px-6 pb-16 pt-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] text-indigo-200 font-bold mb-1">
            Offline
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-2">KYC Watermark Generator</h1>
          <p className="text-slate-300 max-w-3xl">
            Load an ID image locally, add a purpose-bound watermark, and download a readable version
            for this verification only.
          </p>
        </div>
        <div className="grid gap-2 text-sm text-slate-200">
          <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            Private: runs entirely in your browser
          </span>
          <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            Offline: no uploads or network calls
          </span>
          <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            Keeps IDs readable
          </span>
        </div>
      </header>

      <main className='mt-10'>
        <WatermarkCard preset={watermarkPreset} />
      </main>
    </div>
  );
}

type WatermarkCardProps = {
  preset: Preset;
};

function WatermarkCard({ preset }: WatermarkCardProps) {
  const [settings, setSettings] = useState<WatermarkSettings>(preset.initialSettings);
  const [fileName, setFileName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fontString = useMemo(
    () =>
      `600 ${settings.fontSize}px "Space Grotesk", "Inter", "SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif`,
    [settings.fontSize]
  );

  const lines = useMemo(
    () => settings.text.split('\n').filter((line) => line.trim().length > 0),
    [settings.text]
  );

  const textWidth = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Math.max(...lines.map((l) => l.length * settings.fontSize * 0.6), 0);
    ctx.font = fontString;
    return lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
  }, [lines, settings.fontSize, fontString]);

  const baseSpacingX = useMemo(
    () => Math.max(settings.spacingX, settings.fontSize * 2.6),
    [settings.spacingX, settings.fontSize]
  );

  const baseSpacingY = useMemo(
    () => Math.max(settings.spacingY, settings.fontSize * 2.6),
    [settings.spacingY, settings.fontSize]
  );

  const verticalSpan = useMemo(() => {
    if (lines.length === 0) return settings.fontSize;
    const lineHeight = settings.fontSize + settings.lineGap;
    return lineHeight * lines.length;
  }, [lines.length, settings.fontSize, settings.lineGap]);

  const effectiveSpacingX = useMemo(
    () =>
      Math.max(
        baseSpacingX,
        textWidth + settings.fontSize * 0.6 // pad horizontally to fit the longest line
      ),
    [baseSpacingX, textWidth, settings.fontSize]
  );

  const effectiveSpacingY = useMemo(
    () =>
      Math.max(
        baseSpacingY,
        verticalSpan + settings.fontSize * 0.6 // pad vertically to fit stacked lines
      ),
    [baseSpacingY, verticalSpan, settings.fontSize]
  );

  useEffect(() => {
    if (!imageUrl) {
      setLoadedImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setLoadedImage(img);
    img.src = imageUrl;

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!loadedImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = settings.grayscale ? 'grayscale(100%)' : 'none';
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.fillStyle = settings.color;
    ctx.font = fontString;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(canvas.width / 2 + settings.offsetX, canvas.height / 2 + settings.offsetY);
    ctx.rotate((Math.PI / 180) * settings.angle);

    const diagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    const stepX = effectiveSpacingX;
    const stepY = effectiveSpacingY;

    const lineHeight = settings.fontSize + settings.lineGap;
    const rows: number[] = [];
    for (let y = -diagonal; y <= diagonal; y += stepY) {
      rows.push(y);
    }
    const centerRowIndex = Math.floor(rows.length / 2);

    rows.forEach((y, rowIndex) => {
      const rowOffset = (rowIndex - centerRowIndex) * settings.stagger;
      for (let x = -diagonal + rowOffset - stepX; x <= diagonal + stepX; x += stepX) {
        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + index * lineHeight);
        });
      }
    });

    ctx.restore();
  }, [loadedImage, settings, effectiveSpacingX, effectiveSpacingY, fontString, lines]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setFileName(file.name);
    setImageUrl(nextUrl);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = preset.downloadName;
        a.click();
        URL.revokeObjectURL(url);
      },
      'image/png',
      0.94
    );
  };

  const resetSettings = () => setSettings(preset.initialSettings);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] text-indigo-200 font-bold mb-1">
            Watermark
          </p>
          <h2 className="text-2xl font-semibold">{preset.title}</h2>
          <p className="text-slate-300">
            Desaturate if needed and stamp a repeating diagonal watermark while keeping ID data
            legible.
          </p>
          <p className="text-indigo-200 text-sm mt-1">
            Start with low opacity; nudge spacing or offsets if text sits on faces or stamps.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-start md:justify-end">
          <label className="relative inline-flex items-center justify-center h-10 px-4 rounded-xl border border-white/10 bg-white/10 text-sm font-semibold text-slate-50 cursor-pointer whitespace-nowrap">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <span>{fileName || `Load ${preset.title.toLowerCase()} photo`}</span>
          </label>
          <button
            type="button"
            className="h-10 px-4 rounded-xl border border-white/10 bg-transparent text-sm font-semibold text-slate-50 hover:bg-white/5 transition"
            onClick={resetSettings}
            aria-label="Reset watermark settings"
          >
            Reset
          </button>
          <button
            type="button"
            className="h-10 px-4 rounded-xl border border-cyan-200/80 bg-gradient-to-r from-cyan-200/25 to-slate-300/20 text-sm font-semibold text-slate-50 hover:from-cyan-200/35 hover:to-slate-300/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            onClick={handleDownload}
            disabled={!loadedImage}
          >
            Download
          </button>
        </div>
      </div>

      <div className="grid gap-4 mt-4">
        <div className="bg-white/5 border border-white/10 border-dashed rounded-xl min-h-[260px] grid place-items-center p-3">
          {loadedImage ? (
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            />
          ) : (
            <div className="text-center text-slate-300">
              <p>Drop an ID image to preview.</p>
              <small className="text-indigo-200">Everything stays on-device.</small>
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <ControlGroup label="Watermark text">
            <textarea
              rows={3}
              value={settings.text}
              onChange={(e) => setSettings({ ...settings, text: e.target.value })}
              placeholder="Enter one line per watermark row"
              className="w-full min-h-[84px] rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-slate-50 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:border-transparent transition"
            />
          </ControlGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <ControlGroup label="Angle" hint="Diagonal line of text">
              <input
                type="range"
                min={-60}
                max={60}
                step={1}
                value={settings.angle}
                onChange={(e) => setSettings({ ...settings, angle: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.angle}°
              </span>
            </ControlGroup>
            <ControlGroup label="Opacity" hint="Keep data readable">
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.01}
                value={settings.opacity}
                onChange={(e) => setSettings({ ...settings, opacity: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {(settings.opacity * 100).toFixed(0)}%
              </span>
            </ControlGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ControlGroup label="Font size">
              <input
                type="range"
                min={18}
                max={64}
                step={1}
                value={settings.fontSize}
                onChange={(e) => setSettings({ ...settings, fontSize: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.fontSize}px
              </span>
            </ControlGroup>
            <ControlGroup label="Line gap" hint="Spacing between stacked lines in the tile">
              <input
                type="range"
                min={6}
                max={40}
                step={1}
                value={settings.lineGap}
                onChange={(e) => setSettings({ ...settings, lineGap: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.lineGap}px
              </span>
            </ControlGroup>
            <ControlGroup
              label="Row offset"
              hint="Shift rows away from center (top rows negative, bottom rows positive)"
            >
              <input
                type="range"
                min={-200}
                max={200}
                step={5}
                value={settings.stagger}
                onChange={(e) => setSettings({ ...settings, stagger: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.stagger}px
              </span>
            </ControlGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ControlGroup label="Horizontal spacing" hint="Distance between repeats on X">
              <input
                type="range"
                min={110}
                max={320}
                step={5}
                value={settings.spacingX}
                onChange={(e) => setSettings({ ...settings, spacingX: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {Math.round(effectiveSpacingX)}px
              </span>
            </ControlGroup>
            <ControlGroup label="Vertical spacing" hint="Distance between repeats on Y">
              <input
                type="range"
                min={110}
                max={320}
                step={5}
                value={settings.spacingY}
                onChange={(e) => setSettings({ ...settings, spacingY: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {Math.round(effectiveSpacingY)}px
              </span>
            </ControlGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ControlGroup label="Color">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => setSettings({ ...settings, color: e.target.value })}
                className="w-12 h-8 rounded-md border border-white/10 bg-transparent p-0"
              />
            </ControlGroup>
            <ControlGroup label="Grayscale">
              <label className="inline-flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={settings.grayscale}
                  onChange={(e) => setSettings({ ...settings, grayscale: e.target.checked })}
                  className="h-5 w-5 accent-cyan-300"
                />
                <span>{settings.grayscale ? 'Enabled' : 'Disabled'}</span>
              </label>
            </ControlGroup>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ControlGroup label="Offset X" hint="Shift the pattern horizontally">
              <input
                type="range"
                min={-200}
                max={200}
                step={5}
                value={settings.offsetX}
                onChange={(e) => setSettings({ ...settings, offsetX: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.offsetX}px
              </span>
            </ControlGroup>
            <ControlGroup label="Offset Y" hint="Shift the pattern vertically">
              <input
                type="range"
                min={-200}
                max={200}
                step={5}
                value={settings.offsetY}
                onChange={(e) => setSettings({ ...settings, offsetY: Number(e.target.value) })}
                className="w-full accent-cyan-300"
              />
              <span className="text-indigo-200 min-w-[42px] text-right font-mono">
                {settings.offsetY}px
              </span>
            </ControlGroup>
          </div>
        </div>
      </div>
    </section>
  );
}

type ControlGroupProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

function ControlGroup({ label, hint, children }: ControlGroupProps) {
  return (
    <label className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {hint && <small className="text-indigo-200 text-md">{hint}</small>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </label>
  );
}

export default App;
