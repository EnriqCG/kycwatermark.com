import {
  ChangeEvent,
  DragEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

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

const watermarkPreset: Preset = {
  title: 'Document Watermark',
  description:
    'Add a purpose-specific watermark to ID images without uploading anything. Everything stays local in your browser.',
  hint: 'Start with low opacity, then tune spacing and offsets so key details remain readable.',
  downloadName: 'watermarked-id.png',
  initialSettings: {
    text: 'KYC for booking on dates XYZ',
    angle: -32,
    opacity: 0.33,
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
              icon={<IconShield className="h-4 w-4" />}
              text="Open source"
              href="https://github.com/EnriqCG/kycwatermark.com"
              trailingIcon={<IconExternalLink className="h-3.5 w-3.5" />}
            />
            <TrustPill icon={<IconNoUpload className="h-4 w-4" />} text="Local. No uploads" />
            <TrustPill icon={<IconEye className="h-4 w-4" />} text="Interactive controls" />
          </div>
        </div>
      </header>

      <main className="mt-8">
        <WatermarkStudio preset={watermarkPreset} />
      </main>
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

  const fontString = useMemo(
    () =>
      `600 ${settings.fontSize}px "Avenir Next", "Sora", "Manrope", "Trebuchet MS", "Segoe UI", sans-serif`,
    [settings.fontSize]
  );

  const lines = useMemo(
    () => settings.text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    [settings.text]
  );

  const textWidth = useMemo(() => {
    if (lines.length === 0) return 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return lines.reduce((maxWidth, line) => Math.max(maxWidth, line.length * settings.fontSize * 0.58), 0);
    }
    ctx.font = fontString;
    return lines.reduce((maxWidth, line) => Math.max(maxWidth, ctx.measureText(line).width), 0);
  }, [fontString, lines, settings.fontSize]);

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
    () => Math.max(baseSpacingX, textWidth + settings.fontSize * 0.6),
    [baseSpacingX, textWidth, settings.fontSize]
  );

  const effectiveSpacingY = useMemo(
    () => Math.max(baseSpacingY, verticalSpan + settings.fontSize * 0.6),
    [baseSpacingY, verticalSpan, settings.fontSize]
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

    context.translate(canvas.width / 2 + settings.offsetX, canvas.height / 2 + settings.offsetY);
    context.rotate((Math.PI / 180) * settings.angle);

    const diagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    const lineHeight = settings.fontSize + settings.lineGap;
    const rows: number[] = [];

    for (let y = -diagonal; y <= diagonal; y += effectiveSpacingY) {
      rows.push(y);
    }

    const centerRowIndex = Math.floor(rows.length / 2);

    rows.forEach((y, rowIndex) => {
      const rowOffset = (rowIndex - centerRowIndex) * settings.stagger;

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
            <IconUpload className="h-4 w-4" />
            Upload image
          </button>

          <button
            type="button"
            className="action-btn action-btn-muted"
            onClick={resetSettings}
            aria-label="Reset settings"
          >
            <IconRotate className="h-4 w-4" />
            Reset controls
          </button>

          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={handleDownload}
            disabled={!loadedImage}
          >
            <IconDownload className="h-4 w-4" />
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
                <IconUpload className="h-6 w-6 text-cyan-100" />
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
          icon={<IconType className="h-5 w-5" />}
          title="Text and visibility"
          subtitle="Define message, angle, and opacity first."
        >
          <label className="control-card block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-50">Watermark text</span>
              <span className="text-xs text-slate-300">One line per row</span>
            </div>
            <textarea
              name="watermark-text"
              rows={3}
              value={settings.text}
              onChange={(event) => updateSetting('text', event.target.value)}
              placeholder="KYC for booking on dates XYZ"
              className="w-full min-h-[96px] resize-y rounded-xl border border-white/15 bg-slate-900/45 px-3 py-2.5 text-[15px] text-slate-50 placeholder:text-slate-400 focus:border-cyan-200/70 focus:outline-none"
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
          icon={<IconTypography className="h-5 w-5" />}
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
            hint="Space between stacked lines"
            valueLabel={`${settings.lineGap}px`}
            min={6}
            max={40}
            step={1}
            value={settings.lineGap}
            onChange={(value) => updateSetting('lineGap', value)}
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
          icon={<IconPattern className="h-5 w-5" />}
          title="Pattern geometry"
          subtitle="Control how often and where text repeats."
        >
          <RangeControl
            name="wm-spacing-x"
            label="Horizontal spacing"
            valueLabel={`${settings.spacingX}px`}
            min={110}
            max={320}
            step={5}
            value={settings.spacingX}
            onChange={(value) => updateSetting('spacingX', value)}
            footer={`Effective after text fit: ${Math.round(effectiveSpacingX)}px`}
          />

          <RangeControl
            name="wm-spacing-y"
            label="Vertical spacing"
            valueLabel={`${settings.spacingY}px`}
            min={110}
            max={320}
            step={5}
            value={settings.spacingY}
            onChange={(value) => updateSetting('spacingY', value)}
            footer={`Effective after line fit: ${Math.round(effectiveSpacingY)}px`}
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
  onChange
}: RangeControlProps) {
  return (
    <label className="control-card block">
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

type IconProps = {
  className?: string;
};

function IconUpload({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Upload icon</title>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 14.5v3.5A2 2 0 0 0 6 20h12a2 2 0 0 0 2-2v-3.5" />
    </svg>
  );
}

function IconDownload({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Download icon</title>
      <path d="M12 4v12" />
      <path d="m17 11-5 5-5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function IconRotate({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Reset icon</title>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconShield({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Code icon</title>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconEye({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Sliders icon</title>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M1 14h6" />
      <path d="M9 8h6" />
      <path d="M17 16h6" />
    </svg>
  );
}

function IconNoUpload({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Offline icon</title>
      <path d="M12 20h.01" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function IconExternalLink({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>External link icon</title>
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

function IconType({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Text controls icon</title>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  );
}

function IconTypography({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Style controls icon</title>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

function IconPattern({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>Pattern controls icon</title>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export default App;
