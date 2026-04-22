import {
  ChangeEvent,
  DragEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import cx from './cx';
import ExternalLinkIcon from './icon/ExternalLinkIcon';
import NoUploadIcon from './icon/NoUploadIcon';
import EyeIcon from './icon/EyeIcon';
import UploadIcon from './icon/UploadIcon';
import RotateIcon from './icon/RotateIcon';
import DownloadIcon from './icon/DownloadIcon';
import TypeIcon from './icon/TypeIcon';
import TypographyIcon from './icon/TypographyIcon';
import PatternIcon from './icon/PatternIcon';
import GitHubIcon from './icon/GithubIcon';

declare const __COMMIT_HASH__: string;

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

type Notice = {
  tone: 'error' | 'info';
  message: string;
};

type PreviewMode = 'original' | 'watermarked';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const REFERENCE_DIAGONAL = 1000;

const watermarkPreset: Preset = {
  title: 'Document Watermark',
  description:
    'Add a purpose-specific watermark to ID images without uploading anything. Everything stays local in your browser.',
  hint: 'Start with low opacity, then tune spacing and offsets so key details remain readable.',
  downloadName: 'watermarked-id.png',
  initialSettings: {
    text: 'Only for verification at [Company]',
    angle: -32,
    opacity: 0.33,
    fontSize: 34,
    spacingX: 520,
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
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="glass-card animate-rise-in relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-amber-200/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">KYC Watermark</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-50 sm:text-[2.35rem]">
              Watermark documents or IDs
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <TrustPill
              icon={<GitHubIcon className="h-4 w-4" />}
              text="Open source"
              href="https://github.com/EnriqCG/kycwatermark.com"
              trailingIcon={<ExternalLinkIcon className="h-3.5 w-3.5" />}
            />
            <TrustPill icon={<NoUploadIcon className="h-4 w-4" />} text="Local. No uploads" />
            <TrustPill icon={<EyeIcon className="h-4 w-4" />} text="Interactive controls" />
          </div>
        </div>
      </header>

      <main className="mt-8">
        <WatermarkStudio preset={watermarkPreset} />
      </main>

      <section className="glass-card mt-12 px-5 py-6 sm:px-7">
        <h2 className="text-xl font-semibold text-slate-50">What is KYC Watermarker?</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          KYC Watermarker is a free, open-source tool that adds visible watermarks to identity
          documents before you share them. All processing happens locally in your browser. Your
          files are never uploaded to any server.
        </p>
        <h3 className="mt-5 text-base font-semibold text-slate-100">Why watermark your documents?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          When you share ID documents for verification (KYC), adding a purpose-specific watermark
          like "Only for verification at [Company Name]" helps prevent misuse if the document is
          leaked or forwarded.
        </p>
        <h3 className="mt-5 text-base font-semibold text-slate-100">How it works</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-200">
          <li>Upload or drag your ID image into the website</li>
          <li>Customize the watermark text, opacity, angle, and spacing</li>
          <li>Download the watermarked image as a PNG</li>
        </ol>
      </section>

      <footer className="mt-8 text-center text-xs text-slate-400/60">
        {__COMMIT_HASH__}{import.meta.env.DEV ? '-dev' : ''}
      </footer>
    </div>
  );
}

type WatermarkStudioProps = {
  preset: Preset;
};

function WatermarkStudio({ preset }: WatermarkStudioProps) {
  const [settings, setSettings] = useState<WatermarkSettings>({ ...preset.initialSettings });
  const [fileName, setFileName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('watermarked');
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  const scaleFactor = useMemo(() => {
    if (!loadedImage) return 1;
    const diag = Math.sqrt(loadedImage.naturalWidth ** 2 + loadedImage.naturalHeight ** 2);
    return diag / REFERENCE_DIAGONAL;
  }, [loadedImage]);

  const scaledFontSize = settings.fontSize * scaleFactor;
  const scaledSpacingX = settings.spacingX * scaleFactor;
  const scaledSpacingY = settings.spacingY * scaleFactor;
  const scaledLineGap = settings.lineGap * scaleFactor;
  const scaledOffsetX = settings.offsetX * scaleFactor;
  const scaledOffsetY = settings.offsetY * scaleFactor;
  const scaledStagger = settings.stagger * scaleFactor;

  const fontString = useMemo(
    () =>
      `600 ${scaledFontSize}px "Avenir Next", "Sora", "Manrope", "Trebuchet MS", "Segoe UI", sans-serif`,
    [scaledFontSize]
  );

  const maxLineWidth = useMemo(
    () => scaledSpacingX - scaledFontSize * 0.6,
    [scaledSpacingX, scaledFontSize]
  );

  const { lines, textWidth } = useMemo(() => {
    const text = settings.text.trim();
    if (!text) return { lines: [], textWidth: 0 };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return { lines: [text], textWidth: text.length * scaledFontSize * 0.58 };
    }

    ctx.font = fontString;

    const words = text.split(/\s+/);
    const wrappedLines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) wrappedLines.push(currentLine);

    const measuredWidth = wrappedLines.reduce(
      (max, line) => Math.max(max, ctx.measureText(line).width), 0
    );

    return { lines: wrappedLines, textWidth: measuredWidth };
  }, [settings.text, fontString, maxLineWidth, scaledFontSize]);

  const verticalSpan = useMemo(() => {
    if (lines.length === 0) return scaledFontSize;
    const lineHeight = scaledFontSize + scaledLineGap;
    return lineHeight * lines.length;
  }, [lines.length, scaledFontSize, scaledLineGap]);

  const effectiveSpacingX = useMemo(
    () => Math.max(scaledSpacingX, textWidth + scaledFontSize * 0.6),
    [scaledSpacingX, textWidth, scaledFontSize]
  );

  const effectiveSpacingY = useMemo(
    () => Math.max(scaledSpacingY, verticalSpan + scaledFontSize * 0.6),
    [scaledSpacingY, verticalSpan, scaledFontSize]
  );

  const imageStats = useMemo(() => {
    if (!loadedImage) return 'No file loaded';
    return `${loadedImage.naturalWidth} × ${loadedImage.naturalHeight}px`;
  }, [loadedImage]);

  const downloadFileName = useMemo(() => {
    if (!fileName) return preset.downloadName;
    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    return `${baseName}-kyc-watermarked.png`;
  }, [fileName, preset.downloadName]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) {
      setLoadedImage(null);
      return;
    }

    const image = new Image();
    image.onload = () => setLoadedImage(image);
    image.onerror = () => {
      setLoadedImage(null);
      setNotice({ tone: 'error', message: 'Could not decode that image. Try another file.' });
    };
    image.src = imageUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!loadedImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;

    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.filter = previewMode === 'watermarked' && settings.grayscale ? 'grayscale(100%)' : 'none';
    context.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    context.restore();

    if (previewMode !== 'watermarked' || lines.length === 0 || settings.opacity <= 0) {
      return;
    }

    context.save();
    context.globalAlpha = settings.opacity;
    context.fillStyle = settings.color;
    context.font = fontString;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.translate(canvas.width / 2 + scaledOffsetX, canvas.height / 2 + scaledOffsetY);
    context.rotate((Math.PI / 180) * settings.angle);

    const diagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    const lineHeight = scaledFontSize + scaledLineGap;
    const rows: number[] = [];

    for (let y = -diagonal; y <= diagonal; y += effectiveSpacingY) {
      rows.push(y);
    }

    const centerRowIndex = Math.floor(rows.length / 2);

    rows.forEach((y, rowIndex) => {
      const rowOffset = (rowIndex - centerRowIndex) * scaledStagger;

      for (
        let x = -diagonal + rowOffset - effectiveSpacingX;
        x <= diagonal + effectiveSpacingX;
        x += effectiveSpacingX
      ) {
        lines.forEach((line, lineIndex) => {
          context.fillText(line, x, y + lineIndex * lineHeight);
        });
      }
    });

    context.restore();
  }, [
    effectiveSpacingX,
    effectiveSpacingY,
    fontString,
    lines,
    loadedImage,
    previewMode,
    settings
  ]);

  const updateSetting = <K extends keyof WatermarkSettings>(
    key: K,
    value: WatermarkSettings[K]
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const loadImageFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', message: 'Please drop a valid image file (PNG, JPG, WebP, HEIC).' });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setNotice({ tone: 'error', message: 'Image is too large. Keep files under 20MB.' });
      return;
    }

    const nextUrl = URL.createObjectURL(file);

    setImageUrl(nextUrl);
    setFileName(file.name);
    setPreviewMode('watermarked');
    setNotice({ tone: 'info', message: `Loaded ${file.name}` });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadImageFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDropAreaDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!Array.from(event.dataTransfer.types).includes('Files')) return;

    dragDepth.current += 1;
    setIsDragActive(true);
  };

  const handleDropAreaDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };

  const handleDropAreaDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDropAreaDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepth.current = 0;
    setIsDragActive(false);

    loadImageFile(event.dataTransfer.files?.[0]);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = downloadFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      'image/png',
      0.94
    );
  };

  const resetSettings = () => {
    setSettings({ ...preset.initialSettings });
    setPreviewMode('watermarked');
    setNotice({ tone: 'info', message: 'Settings reset to default values.' });
  };

  const canClickDropArea = !loadedImage;

  return (
    <section className="space-y-5">
      <section className="glass-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-label">Preview</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-50">{preset.title}</h2>
            <p className="mt-2 text-sm text-slate-200">{preset.hint}</p>
            <p className="mt-1 text-xs text-slate-300/90">
              {fileName ? `${fileName} · ${imageStats}` : 'Upload or drag an ID image into the canvas area.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/15 bg-slate-900/45 p-1">
            <button
              type="button"
              onClick={() => setPreviewMode('original')}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                previewMode === 'original'
                  ? 'bg-slate-200/90 text-slate-950'
                  : 'text-slate-300 hover:bg-white/8'
              )}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('watermarked')}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                previewMode === 'watermarked'
                  ? 'bg-cyan-200/90 text-slate-950'
                  : 'text-slate-300 hover:bg-white/8'
              )}
            >
              <span
                className={cx(
                  'wm-toggle-label',
                  previewMode === 'watermarked' ? 'wm-toggle-label-active' : 'wm-toggle-label-idle'
                )}
              >
                Watermarked
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="action-btn action-btn-muted" onClick={openFilePicker}>
            <UploadIcon className="h-4 w-4" />
            Upload image
          </button>

          <button
            type="button"
            className="action-btn action-btn-muted"
            onClick={resetSettings}
            aria-label="Reset settings"
          >
            <RotateIcon className="h-4 w-4" />
            Reset controls
          </button>

          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={handleDownload}
            disabled={!loadedImage}
          >
            <DownloadIcon className="h-4 w-4" />
            Download PNG
          </button>
        </div>

        <input
          ref={fileInputRef}
          name="wm-file"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          className={cx(
            'relative mt-4 grid min-h-[330px] w-full place-items-center rounded-2xl border border-dashed bg-slate-950/30 p-3 text-left transition sm:min-h-[500px]',
            isDragActive ? 'drop-area-active' : 'border-white/20',
            canClickDropArea ? 'cursor-pointer hover:border-cyan-200/45' : 'cursor-default'
          )}
          aria-label={
            canClickDropArea
              ? 'Drop an image here or click to upload'
              : 'Drop an image here to replace current upload'
          }
          aria-disabled={!canClickDropArea}
          tabIndex={canClickDropArea ? 0 : -1}
          onClick={canClickDropArea ? openFilePicker : undefined}
          onDragEnter={handleDropAreaDragEnter}
          onDragOver={handleDropAreaDragOver}
          onDragLeave={handleDropAreaDragLeave}
          onDrop={handleDropAreaDrop}
        >
          {loadedImage ? (
            <canvas
              ref={canvasRef}
              className="max-h-[66vh] w-full rounded-xl border border-white/15 bg-[#0b1224] object-contain"
            />
          ) : (
            <div className="max-w-sm text-center text-slate-200">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10">
                <UploadIcon className="h-6 w-6 text-cyan-100" />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-50">Drop your ID image here</p>
              <p className="mt-1 text-sm text-slate-300">or click to pick a file from your device</p>
            </div>
          )}

          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-cyan-300/10">
              <p className="rounded-full border border-cyan-100/70 bg-slate-900/75 px-4 py-2 text-sm font-semibold text-cyan-100">
                Drop image to apply watermark
              </p>
            </div>
          )}
        </button>

        {notice && (
          <p
            className={cx(
              'mt-3 rounded-xl border px-3 py-2 text-sm',
              notice.tone === 'error'
                ? 'border-rose-200/50 bg-rose-300/10 text-rose-100'
                : 'border-cyan-200/40 bg-cyan-200/10 text-cyan-50'
            )}
          >
            {notice.message}
          </p>
        )}

        <p className="mt-2 text-xs text-slate-300/90">
          Export name: <span className="font-medium text-slate-100">{downloadFileName}</span>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ControlSection
          icon={<TypeIcon className="h-5 w-5" />}
          title="Text and visibility"
          subtitle="Define message, angle, and opacity first."
        >
          <label className="control-card block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-50">Watermark text</span>
              <span className="text-xs text-slate-300">Auto-wraps when long</span>
            </div>
            <input
              type="text"
              name="watermark-text"
              value={settings.text}
              onChange={(event) => updateSetting('text', event.target.value)}
              placeholder="KYC for booking on dates XYZ"
              className="w-full rounded-xl border border-white/15 bg-slate-900/45 px-3 py-2.5 text-[15px] text-slate-50 placeholder:text-slate-400 focus:border-cyan-200/70 focus:outline-none"
            />
          </label>

          <RangeControl
            name="wm-opacity"
            label="Opacity"
            hint="Keep details readable"
            valueLabel={`${(settings.opacity * 100).toFixed(0)}%`}
            min={0.05}
            max={0.6}
            step={0.01}
            value={settings.opacity}
            onChange={(value) => updateSetting('opacity', value)}
          />

          <RangeControl
            name="wm-angle"
            label="Angle"
            hint="Diagonal watermark tilt"
            valueLabel={`${settings.angle}deg`}
            min={-60}
            max={60}
            step={1}
            value={settings.angle}
            onChange={(value) => updateSetting('angle', value)}
          />

          <label className="control-card flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-50">Grayscale source</p>
              <p className="mt-1 text-xs text-slate-300">Useful when original colors reduce watermark contrast.</p>
            </div>
            <input
              name="wm-grayscale"
              type="checkbox"
              checked={settings.grayscale}
              onChange={(event) => updateSetting('grayscale', event.target.checked)}
              className="h-5 w-5 accent-cyan-300"
            />
          </label>
        </ControlSection>

        <ControlSection
          icon={<TypographyIcon className="h-5 w-5" />}
          title="Typography and color"
          subtitle="Tune style without overpowering document data."
        >
          <RangeControl
            name="wm-font-size"
            label="Font size"
            valueLabel={`${settings.fontSize}px`}
            min={18}
            max={64}
            step={1}
            value={settings.fontSize}
            onChange={(value) => updateSetting('fontSize', value)}
          />

          <RangeControl
            name="wm-line-gap"
            label="Line gap"
            hint="Space between wrapped lines"
            valueLabel={`${settings.lineGap}px`}
            min={6}
            max={40}
            step={1}
            value={settings.lineGap}
            disabled={lines.length <= 1}
            onChange={(value) => updateSetting('lineGap', value)}
            footer={lines.length <= 1 ? 'Type longer text to see wrapping' : undefined}
          />

          <label className="control-card flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-50">Watermark color</p>
              <p className="mt-1 text-xs text-slate-300">Current: {settings.color.toUpperCase()}</p>
            </div>
            <input
              name="wm-color"
              type="color"
              value={settings.color}
              onChange={(event) => updateSetting('color', event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-white/20 bg-transparent p-1"
            />
          </label>
        </ControlSection>

        <ControlSection
          icon={<PatternIcon className="h-5 w-5" />}
          title="Pattern geometry"
          subtitle="Control how often and where text repeats."
        >
          <RangeControl
            name="wm-spacing-x"
            label="Horizontal spacing"
            valueLabel={`${settings.spacingX}px`}
            min={150}
            max={800}
            step={5}
            value={settings.spacingX}
            onChange={(value) => updateSetting('spacingX', value)}
            footer={`Effective: ${Math.round(effectiveSpacingX)}px`}
          />

          <RangeControl
            name="wm-spacing-y"
            label="Vertical spacing"
            valueLabel={`${settings.spacingY}px`}
            min={80}
            max={400}
            step={5}
            value={settings.spacingY}
            onChange={(value) => updateSetting('spacingY', value)}
            footer={`Effective: ${Math.round(effectiveSpacingY)}px`}
          />

          <RangeControl
            name="wm-stagger"
            label="Row stagger"
            hint="Shift each row from center"
            valueLabel={`${settings.stagger}px`}
            min={-200}
            max={200}
            step={5}
            value={settings.stagger}
            onChange={(value) => updateSetting('stagger', value)}
          />

          <RangeControl
            name="wm-offset-x"
            label="Offset X"
            valueLabel={`${settings.offsetX}px`}
            min={-200}
            max={200}
            step={5}
            value={settings.offsetX}
            onChange={(value) => updateSetting('offsetX', value)}
          />

          <RangeControl
            name="wm-offset-y"
            label="Offset Y"
            valueLabel={`${settings.offsetY}px`}
            min={-200}
            max={200}
            step={5}
            value={settings.offsetY}
            onChange={(value) => updateSetting('offsetY', value)}
          />
        </ControlSection>
      </section>
    </section>
  );
}

type ControlSectionProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

function ControlSection({ icon, title, subtitle, children }: ControlSectionProps) {
  return (
    <section className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/35 bg-cyan-200/15 text-cyan-50">
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-50">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

type RangeControlProps = {
  name: string;
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  hint?: string;
  footer?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function RangeControl({
  name,
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  hint,
  footer,
  disabled,
  onChange
}: RangeControlProps) {
  return (
    <label className={cx('control-card block', disabled && 'opacity-45')}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-50">{label}</span>
        <span className="text-xs font-medium text-cyan-100">{valueLabel}</span>
      </div>

      {hint && <p className="mt-1 text-xs text-slate-300">{hint}</p>}

      <input
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-input mt-3"
      />

      {footer && <p className="mt-1 text-xs text-slate-300">{footer}</p>}
    </label>
  );
}

type TrustPillProps = {
  icon: ReactNode;
  text: string;
  href?: string;
  trailingIcon?: ReactNode;
};

function TrustPill({ icon, text, href, trailingIcon }: TrustPillProps) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="trust-pill trust-pill-link">
        {icon}
        <span>{text}</span>
        {trailingIcon}
      </a>
    );
  }

  return (
    <span className="trust-pill">
      {icon}
      <span>{text}</span>
    </span>
  );
}

export default App;
