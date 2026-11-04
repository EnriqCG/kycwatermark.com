import {
  type ChangeEvent,
  type DOMAttributes,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "./cx";
import BrandIcon from "./icon/BrandIcon";
import CameraIcon from "./icon/CameraIcon";
import CheckIcon from "./icon/CheckIcon";
import ChevronDownIcon from "./icon/ChevronDownIcon";
import CodeIcon from "./icon/CodeIcon";
import CompareIcon from "./icon/CompareIcon";
import DeviceIcon from "./icon/DeviceIcon";
import DownloadIcon from "./icon/DownloadIcon";
import GitHubIcon from "./icon/GithubIcon";
import InfoIcon from "./icon/InfoIcon";
import LocationOffIcon from "./icon/LocationOffIcon";
import NoUploadIcon from "./icon/NoUploadIcon";
import RotateIcon from "./icon/RotateIcon";
import TrashIcon from "./icon/TrashIcon";
import UndoIcon from "./icon/UndoIcon";
import UploadIcon from "./icon/UploadIcon";
import {
  composeWatermarkText,
  type EdgeZone,
  edgeCursor,
  findEdgeZone,
  findMatchingPreset,
  formatWatermarkDate,
  getDownloadFileName,
  getEffectiveWatermarkSpacing,
  getImageFileValidationError,
  getScaleFactor,
  pointInRect,
  pointOnDeleteHandle,
  pointOnRotationHandle,
  type RedactionRect,
  resizeRect,
  type StrengthValues,
  scaleWatermarkSettings,
  screenToCanvas,
  type WatermarkSettings,
  wrapWatermarkText,
} from "./imageLogic";
import {
  createSampleDocumentFile,
  drawSampleDocument,
  loadSampleFonts,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
} from "./rendering/sampleDocument";
import { renderWatermarkedImage } from "./rendering/watermarkRenderer";
import type { IconProps } from "./types/icon";

declare const __COMMIT_HASH__: string;

type Preset = {
  title: string;
  description: string;
  hint: string;
  initialSettings: WatermarkSettings;
  downloadName: string;
};

type Notice = {
  tone: "error" | "info";
  message: string;
};

type PreviewMode = "original" | "watermarked";

type InteractionMode = "idle" | "drawing" | "moving" | "rotating" | "resizing";
type HitZone = "handle" | "delete" | EdgeZone | "body";

type Step = "hide" | "mark" | "export";
type TextMode = "suggested" | "custom";

type Purpose = {
  id: string;
  label: string;
  phrase: string;
};

type StrengthPreset = {
  id: string;
  label: string;
  note: string;
  values: StrengthValues;
};

const watermarkPreset: Preset = {
  title: "Document Watermark",
  description:
    "Add a purpose-specific watermark to ID images without uploading anything. Everything stays local in your browser.",
  hint: "Start with low opacity, then tune spacing and offsets so key details remain readable.",
  downloadName: "watermarked-id.png",
  initialSettings: {
    text: "Only for verification at [Company]",
    angle: -32,
    opacity: 0.4,
    fontSize: 34,
    spacingX: 520,
    spacingY: 180,
    color: "#353B46",
    grayscale: false,
    offsetX: 0,
    offsetY: 0,
    lineGap: 12,
    stagger: 0,
  },
};

const steps: ReadonlyArray<{ id: Step; label: string }> = [
  { id: "hide", label: "Hide details" },
  { id: "mark", label: "Watermark" },
  { id: "export", label: "Export" },
];

const purposes: readonly Purpose[] = [
  { id: "identity", label: "Identity check", phrase: "identity verification" },
  { id: "account", label: "Opening an account", phrase: "account opening" },
  {
    id: "rental",
    label: "Rental application",
    phrase: "a rental application",
  },
  { id: "job", label: "New job", phrase: "employment checks" },
];

// Balanced matches the preset's initial settings so a fresh document starts on it.
const strengthPresets: readonly StrengthPreset[] = [
  {
    id: "subtle",
    label: "Subtle",
    note: "Subtle keeps every detail easy to read.",
    values: { opacity: 0.22, fontSize: 30, spacingX: 560, spacingY: 220 },
  },
  {
    id: "balanced",
    label: "Balanced",
    note: "Balanced is recommended: readable, and hard to crop out.",
    values: { opacity: 0.4, fontSize: 34, spacingX: 520, spacingY: 180 },
  },
  {
    id: "bold",
    label: "Bold",
    note: "Bold is very hard to remove but can cover small print.",
    values: { opacity: 0.55, fontSize: 44, spacingX: 560, spacingY: 190 },
  },
  {
    id: "dense",
    label: "Dense",
    note: "Dense leaves no clean area to crop.",
    values: { opacity: 0.32, fontSize: 26, spacingX: 360, spacingY: 120 },
  },
];

const colorSwatches = [
  { name: "Graphite", hex: "#353B46" },
  { name: "Blue", hex: "#2F5BEA" },
  { name: "Red", hex: "#B42318" },
  { name: "White", hex: "#FFFFFF" },
] as const;

const previewRows = [0, 1, 2, 3, 4, 5, 6] as const;

const repositoryUrl = "https://github.com/EnriqCG/kycwatermark.com";

function getWatermarkFont(fontSize: number) {
  return `600 ${fontSize}px "Avenir Next", "Sora", "Manrope", "Trebuchet MS", "Segoe UI", sans-serif`;
}

function App() {
  return <WatermarkStudio preset={watermarkPreset} />;
}

type DropHandlers = Pick<
  DOMAttributes<HTMLElement>,
  "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
>;

type LandingPageProps = {
  isDragActive: boolean;
  error: string | null;
  dropHandlers: DropHandlers;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  onTrySample: () => void;
};

const privacyPoints: ReadonlyArray<{
  icon: (props: IconProps) => ReactNode;
  title: string;
  body: ReactNode;
}> = [
  {
    icon: DeviceIcon,
    title: "Never uploaded",
    body: "Your file is opened and edited inside this browser tab. It isn't sent anywhere.",
  },
  {
    icon: NoUploadIcon,
    title: "Works offline",
    body: "Once the page has loaded you can switch off your connection and keep going.",
  },
  {
    icon: LocationOffIcon,
    title: "Metadata removed",
    body: "The downloaded image carries no location, camera or date-taken details.",
  },
  {
    icon: CodeIcon,
    title: "Open source",
    body: (
      <>
        Every line of code is public on{" "}
        <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        , so anyone can check these claims.
      </>
    ),
  },
];

const faqs: ReadonlyArray<{ question: string; answer: ReactNode }> = [
  {
    question: "Is my data safe?",
    answer:
      "Yes. The image is opened, edited and exported inside this browser tab. Nothing is sent to a server, and there's no account to sign in to.",
  },
  {
    question: "What is KYCWatermark.com?",
    answer:
      "A free, open-source tool that adds visible watermarks to identity documents before you share them. All processing happens locally in your browser.",
  },
  {
    question: "Why watermark my documents?",
    answer:
      "When you send an ID for verification (KYC), a purpose-specific watermark such as “Only for verification at [Company]” makes a leaked or forwarded copy much harder to reuse.",
  },
  {
    question: "What does hiding details do?",
    answer:
      "It covers fields like your document number or address with solid black boxes before the watermark goes on, so you only share what's strictly needed.",
  },
  {
    question: "Is it really free?",
    answer: (
      <>
        Yes. No fees, no accounts and no usage limits. The project is open
        source and can be audited by anyone on{" "}
        <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </>
    ),
  },
  {
    question: "Can I use it on my phone?",
    answer:
      "Yes. It works in any modern mobile browser and you can photograph your document directly. There's no app to install.",
  },
  {
    question: "What file types can I use?",
    answer: "PNG, JPG, WebP and HEIC images up to 20 MB.",
  },
  {
    question: "Can I use it for other documents?",
    answer:
      "Yes. Contracts, certificates, invoices or any image you want to protect from reuse.",
  },
  {
    question: "Who built this and why?",
    answer:
      "It was built because sending raw, unmarked identity documents online is risky. The aim is a simple, private way to protect them first.",
  },
];

function LandingPage({
  isDragActive,
  error,
  dropHandlers,
  onChooseFile,
  onTakePhoto,
  onTrySample,
}: LandingPageProps) {
  const sampleText = useMemo(
    () =>
      composeWatermarkText(
        purposes[0].phrase,
        "Acme Bank",
        formatWatermarkDate(new Date()),
      ),
    [],
  );

  return (
    <div id="top" className="min-h-screen bg-ground text-ink">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-ink text-white">
            <BrandIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="font-semibold tracking-tight">KYC Watermark</span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-1">
          <a href="#how" className="nav-link max-sm:hidden">
            How it works
          </a>
          <a href="#faq" className="nav-link">
            FAQ
          </a>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn action-btn-quiet ml-1"
          >
            <GitHubIcon className="h-4 w-4" />
            <span className="max-sm:sr-only">Open source</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1200px] flex-col items-center px-4 pt-10 text-center sm:px-6 sm:pt-14">
          <p className="inline-flex items-center gap-2 rounded-full bg-success-soft py-1.5 pl-2.5 pr-3 text-sm font-medium text-success">
            <DeviceIcon className="h-4 w-4" />
            Runs in your browser · nothing is uploaded
          </p>
          <h1 className="mt-5 max-w-[860px] text-balance text-[40px] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-6xl sm:leading-[1.04]">
            Watermark your ID before you hand it over.
          </h1>
          <p className="mt-5 max-w-[640px] text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
            Black out what they don't need, stamp who it's for and when, and
            download a copy that's clearly marked for that purpose only.
          </p>
        </section>

        <section
          aria-label="Start"
          className="mx-auto mt-10 max-w-[1200px] px-4 sm:mt-12 sm:px-6"
          {...dropHandlers}
        >
          <div className="flex flex-wrap gap-3 rounded-3xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(14,18,24,0.04),0_24px_48px_-24px_rgba(14,18,24,0.14)]">
            <div
              className={cx(
                "flex min-h-[340px] min-w-0 flex-[1_1_400px] flex-col items-center justify-center gap-5 rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors sm:min-h-[460px]",
                isDragActive
                  ? "border-accent bg-accent-soft"
                  : "border-[#c4cbd6] bg-[#fafbfc]",
              )}
            >
              <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-accent-soft text-accent">
                <UploadIcon className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {isDragActive ? "Drop to open it" : "Drop your document here"}
                </h2>
                <p className="mt-2 text-[15px] text-ink-3">
                  PNG, JPG, WebP or HEIC · up to 20 MB
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  className="action-btn action-btn-primary action-btn-lg"
                  onClick={onChooseFile}
                >
                  Choose a file
                </button>
                <button
                  type="button"
                  className="action-btn action-btn-quiet action-btn-lg hidden pointer-coarse:inline-flex"
                  onClick={onTakePhoto}
                >
                  <CameraIcon className="h-[18px] w-[18px]" />
                  Take a photo
                </button>
              </div>
              <button
                type="button"
                className="link-btn text-[15px] font-medium"
                onClick={onTrySample}
              >
                No document handy? Try it with a sample ID →
              </button>
              {error && (
                <p className="notice-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="canvas-dots flex min-w-0 flex-[1.25_1_480px] flex-col justify-center gap-5 rounded-2xl px-5 py-6 sm:px-8 sm:pb-8 sm:pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                  What the company receives
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[13px] font-medium">
                  <span className="h-[7px] w-2.5 rounded-[2px] bg-[#0b0d10]" />3
                  details hidden
                </span>
              </div>
              <SamplePreview text={sampleText} />
              <p className="font-mono text-[13px] text-ink-2">“{sampleText}”</p>
            </div>
          </div>
        </section>

        <section
          aria-label="Privacy"
          className="mx-auto mt-16 grid max-w-[1200px] gap-8 px-4 sm:mt-[72px] sm:grid-cols-2 sm:px-6 lg:grid-cols-4"
        >
          {privacyPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-1 text-[17px] font-semibold">{title}</h3>
              <p className="text-[15px] text-ink-2">{body}</p>
            </div>
          ))}
        </section>

        <section
          id="how"
          aria-labelledby="how-title"
          className="mx-auto mt-24 flex max-w-[1200px] scroll-mt-6 flex-col gap-8 px-4 sm:mt-[120px] sm:px-6"
        >
          <div className="flex flex-col gap-2">
            <p className="section-label">How it works</p>
            <h2
              id="how-title"
              className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]"
            >
              Three steps, all on your device
            </h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            <HowStep
              number="01"
              title="Add your document"
              body="Drop a scan or photo of your ID, or take a picture with your phone's camera."
            >
              <div className="grid h-[116px] w-[180px] place-items-center rounded-xl border-[1.5px] border-dashed border-[#9aa6b6] bg-white/60">
                <div className="flex flex-col items-center gap-2 text-accent">
                  <UploadIcon className="h-[26px] w-[26px]" />
                  <span className="h-1.5 w-[72px] rounded-full bg-[#c9d1dc]" />
                </div>
              </div>
            </HowStep>
            <HowStep
              number="02"
              title="Hide what they don't need"
              body="Drag boxes over your document number, address or anything the company hasn't asked for."
            >
              <MiniCard>
                <span className="h-1.5 w-4/5 rounded-full bg-[#a9b5c4]" />
                <span className="h-1.5 w-3/5 rounded-full bg-[#a9b5c4]" />
                <span className="h-2.5 w-[90%] rounded-[2px] bg-[#0b0d10]" />
                <span className="h-1.5 w-1/2 rounded-full bg-[#a9b5c4]" />
                <span className="h-2.5 w-full rounded-[2px] bg-[#0b0d10]" />
              </MiniCard>
            </HowStep>
            <HowStep
              number="03"
              title="Stamp it and send"
              body="Say who it's for and why. Today's date is added for you, then download the protected copy."
            >
              <MiniCard watermark>
                <span className="h-1.5 w-4/5 rounded-full bg-[#a9b5c4]" />
                <span className="h-1.5 w-3/5 rounded-full bg-[#a9b5c4]" />
                <span className="h-1.5 w-[70%] rounded-full bg-[#a9b5c4]" />
              </MiniCard>
            </HowStep>
          </ol>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-title"
          className="mx-auto mt-24 flex max-w-[1200px] scroll-mt-6 flex-wrap gap-x-12 gap-y-8 px-4 sm:mt-[120px] sm:px-6"
        >
          <div className="flex flex-[1_1_280px] flex-col gap-3">
            <p className="section-label">FAQ</p>
            <h2
              id="faq-title"
              className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]"
            >
              Questions, answered
            </h2>
            <p className="text-ink-2">
              Still unsure? Read the code or open an issue on{" "}
              <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              .
            </p>
          </div>
          <div className="min-w-0 flex-[999_1_560px] border-t border-line">
            {faqs.map(({ question, answer }, index) => (
              <details
                key={question}
                open={index === 0}
                className="group border-b border-line"
              >
                <summary className="flex list-none items-center justify-between gap-4 px-1 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="max-w-[640px] px-1 pb-5 text-ink-2">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-24 flex max-w-[1200px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 pb-10 pt-6 text-sm text-ink-3 sm:mt-[120px] sm:px-6">
        <span>Free · No account · No limits</span>
        <span className="font-mono text-[13px]">
          build {__COMMIT_HASH__}
          {import.meta.env.DEV ? "-dev" : ""}
        </span>
      </footer>
    </div>
  );
}

type HowStepProps = {
  number: string;
  title: string;
  body: string;
  children: ReactNode;
};

function HowStep({ number, title, body, children }: HowStepProps) {
  return (
    <li className="flex flex-col gap-4 rounded-[20px] border border-line bg-white px-4 pb-6 pt-4">
      <div
        aria-hidden="true"
        className="canvas-dots grid h-[180px] place-items-center rounded-xl"
      >
        {children}
      </div>
      <div className="flex flex-col gap-1.5 px-2">
        <span className="font-mono text-[13px] text-ink-3">{number}</span>
        <h3 className="text-[19px] font-semibold">{title}</h3>
        <p className="text-[15px] text-ink-2">{body}</p>
      </div>
    </li>
  );
}

type MiniCardProps = {
  watermark?: boolean;
  children: ReactNode;
};

function MiniCard({ watermark = false, children }: MiniCardProps) {
  return (
    <div className="relative flex h-[114px] w-[180px] gap-3 overflow-hidden rounded-[10px] bg-[#e4eaf1] p-3.5 shadow-[0_10px_24px_-12px_rgba(14,18,24,0.3)]">
      <span className="h-[52px] w-10 shrink-0 rounded-[5px] bg-[#c5cfdb]" />
      <div className="flex flex-1 flex-col gap-[7px]">{children}</div>
      {watermark && (
        <div className="absolute -left-[40%] -top-[60%] flex h-[220%] w-[180%] -rotate-[32deg] flex-col justify-center gap-3 whitespace-nowrap text-[10px] font-semibold text-[#353b46] opacity-50">
          {previewRows.map((row) => (
            <span key={row} className={cx(row % 2 === 1 && "-ml-10")}>
              FOR ACME BANK · FOR ACME BANK · FOR ACME BANK · FOR ACME BANK
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type SamplePreviewProps = {
  text: string;
};

// Renders the sample ID through the same pipeline as the editor's export.
function SamplePreview({ text }: SamplePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadSampleFonts().then(() => {
      const context = canvasRef.current?.getContext("2d");
      const source = document.createElement("canvas");
      const sourceContext = source.getContext("2d");
      if (cancelled || !context || !sourceContext) return;

      source.width = SAMPLE_WIDTH;
      source.height = SAMPLE_HEIGHT;
      const redactions = drawSampleDocument(sourceContext);

      const settings = watermarkPreset.initialSettings;
      const scaled = scaleWatermarkSettings(
        settings,
        getScaleFactor(SAMPLE_WIDTH, SAMPLE_HEIGHT),
      );
      const font = getWatermarkFont(scaled.fontSize);
      context.font = font;
      const { lines, textWidth } = wrapWatermarkText(
        text,
        scaled.spacingX - scaled.fontSize * 0.6,
        (line) => context.measureText(line).width,
      );
      const spacing = getEffectiveWatermarkSpacing(
        lines,
        textWidth,
        scaled.fontSize,
        scaled.spacingX,
        scaled.spacingY,
        scaled.lineGap,
      );

      renderWatermarkedImage(context, source, {
        width: SAMPLE_WIDTH,
        height: SAMPLE_HEIGHT,
        watermarked: true,
        grayscale: settings.grayscale,
        redactions,
        lines,
        opacity: settings.opacity,
        color: settings.color,
        font,
        angleDegrees: settings.angle,
        offsetX: scaled.offsetX,
        offsetY: scaled.offsetY,
        spacingX: spacing.spacingX,
        spacingY: spacing.spacingY,
        fontSize: scaled.fontSize,
        lineGap: scaled.lineGap,
        stagger: scaled.stagger,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      width={SAMPLE_WIDTH}
      height={SAMPLE_HEIGHT}
      role="img"
      aria-label="Sample ID card with three details blacked out and a repeating watermark"
      className="block h-auto w-full rounded-[3%/4.75%] bg-[#e4eaf1] shadow-[0_30px_60px_-24px_rgba(14,18,24,0.30),0_2px_6px_rgba(14,18,24,0.08)]"
    />
  );
}

type WatermarkStudioProps = {
  preset: Preset;
};

function WatermarkStudio({ preset }: WatermarkStudioProps) {
  const [settings, setSettings] = useState<WatermarkSettings>({
    ...preset.initialSettings,
  });
  const [textMode, setTextMode] = useState<TextMode>("suggested");
  const [recipient, setRecipient] = useState("");
  const [purposeId, setPurposeId] = useState(purposes[0].id);
  const [includeDate, setIncludeDate] = useState(true);
  const [step, setStep] = useState<Step>("hide");
  const [fileName, setFileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("watermarked");
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [redactions, setRedactions] = useState<RedactionRect[]>([]);
  const [activeRect, setActiveRect] = useState<RedactionRect | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [displayScale, setDisplayScale] = useState(1);
  const [coarsePointer] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const interactionMode = useRef<InteractionMode>("idle");
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRectSnapshot = useRef<RedactionRect | null>(null);
  const dragAngleOffset = useRef(0);
  const dragEdge = useRef<EdgeZone>("top");

  const canRedact = step === "hide" && previewMode === "watermarked";

  const watermarkDate = useMemo(() => formatWatermarkDate(new Date()), []);
  const purpose = purposes.find(({ id }) => id === purposeId) ?? purposes[0];
  const suggestedText = composeWatermarkText(
    purpose.phrase,
    recipient,
    includeDate ? watermarkDate : undefined,
  );
  const watermarkText = textMode === "custom" ? settings.text : suggestedText;
  const activeStrength = findMatchingPreset(settings, strengthPresets);

  const scaleFactor = useMemo(() => {
    if (!loadedImage) return 1;
    return getScaleFactor(loadedImage.naturalWidth, loadedImage.naturalHeight);
  }, [loadedImage]);

  // Selection handles keep a constant on-screen size, larger for fingers.
  const handleScale = displayScale * (coarsePointer ? 1.75 : 1);

  const {
    fontSize: scaledFontSize,
    spacingX: scaledSpacingX,
    spacingY: scaledSpacingY,
    lineGap: scaledLineGap,
    offsetX: scaledOffsetX,
    offsetY: scaledOffsetY,
    stagger: scaledStagger,
  } = scaleWatermarkSettings(settings, scaleFactor);

  const fontString = useMemo(
    () => getWatermarkFont(scaledFontSize),
    [scaledFontSize],
  );

  const maxLineWidth = useMemo(
    () => scaledSpacingX - scaledFontSize * 0.6,
    [scaledSpacingX, scaledFontSize],
  );

  const { lines, textWidth } = useMemo(() => {
    const text = watermarkText.trim();
    if (!text) return { lines: [], textWidth: 0 };

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return { lines: [text], textWidth: text.length * scaledFontSize * 0.58 };
    }

    ctx.font = fontString;

    return wrapWatermarkText(
      text,
      maxLineWidth,
      (line) => ctx.measureText(line).width,
    );
  }, [watermarkText, fontString, maxLineWidth, scaledFontSize]);

  const { spacingX: effectiveSpacingX, spacingY: effectiveSpacingY } = useMemo(
    () =>
      getEffectiveWatermarkSpacing(
        lines,
        textWidth,
        scaledFontSize,
        scaledSpacingX,
        scaledSpacingY,
        scaledLineGap,
      ),
    [
      lines,
      scaledFontSize,
      scaledLineGap,
      scaledSpacingX,
      scaledSpacingY,
      textWidth,
    ],
  );

  const imageStats = useMemo(() => {
    if (!loadedImage) return "No file loaded";
    return `${loadedImage.naturalWidth} × ${loadedImage.naturalHeight}px`;
  }, [loadedImage]);

  const downloadFileName = useMemo(() => {
    return getDownloadFileName(fileName, preset.downloadName, recipient);
  }, [fileName, preset.downloadName, recipient]);

  const getCanvasPoint = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return screenToCanvas({ x: e.clientX, y: e.clientY }, canvas, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  // --- Hit-testing helpers ---

  const findHitTarget = (
    px: number,
    py: number,
  ): { index: number; zone: HitZone } | null => {
    if (selectedIndex !== null && selectedIndex < redactions.length) {
      const r = redactions[selectedIndex];
      if (pointOnRotationHandle(px, py, r, handleScale)) {
        return { index: selectedIndex, zone: "handle" };
      }
      if (pointOnDeleteHandle(px, py, r, handleScale)) {
        return { index: selectedIndex, zone: "delete" };
      }
      const edge = findEdgeZone(px, py, r, handleScale);
      if (edge) {
        return { index: selectedIndex, zone: edge };
      }
    }
    for (let i = redactions.length - 1; i >= 0; i--) {
      if (pointInRect(px, py, redactions[i])) {
        return { index: i, zone: "body" };
      }
    }
    return null;
  };

  // --- Pointer handlers (mouse, touch and pen) ---

  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canRedact || !loadedImage || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getCanvasPoint(e);
    const hit = findHitTarget(pos.x, pos.y);

    if (hit?.zone === "delete") {
      deleteSelectedRedaction();
      return;
    }

    // Keep receiving moves and the release even if the pointer leaves the canvas.
    e.currentTarget.setPointerCapture(e.pointerId);

    if (hit?.zone === "handle") {
      const r = redactions[hit.index];
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const mouseAngle = Math.atan2(pos.x - cx, -(pos.y - cy));
      interactionMode.current = "rotating";
      dragAngleOffset.current = mouseAngle - r.angle;
      dragRectSnapshot.current = { ...r };
      setSelectedIndex(hit.index);
    } else if (
      hit?.zone === "top" ||
      hit?.zone === "bottom" ||
      hit?.zone === "left" ||
      hit?.zone === "right"
    ) {
      interactionMode.current = "resizing";
      dragEdge.current = hit.zone;
      dragRectSnapshot.current = { ...redactions[hit.index] };
      setSelectedIndex(hit.index);
    } else if (hit?.zone === "body") {
      interactionMode.current = "moving";
      dragStart.current = pos;
      dragRectSnapshot.current = { ...redactions[hit.index] };
      setSelectedIndex(hit.index);
    } else {
      interactionMode.current = "drawing";
      dragStart.current = pos;
      setSelectedIndex(null);
      setActiveRect({ x: pos.x, y: pos.y, w: 0, h: 0, angle: 0 });
    }
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !canRedact || !loadedImage || !e.isPrimary) return;

    const pos = getCanvasPoint(e);

    if (interactionMode.current === "idle") {
      const hit = findHitTarget(pos.x, pos.y);
      if (hit?.zone === "handle") {
        canvas.style.cursor = "grab";
      } else if (hit?.zone === "delete") {
        canvas.style.cursor = "pointer";
      } else if (hit?.zone === "body") {
        canvas.style.cursor = "move";
      } else if (hit) {
        canvas.style.cursor = edgeCursor(hit.zone, redactions[hit.index].angle);
      } else {
        canvas.style.cursor = "crosshair";
      }
      return;
    }

    e.preventDefault();

    if (interactionMode.current === "drawing") {
      const start = dragStart.current;
      setActiveRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
        angle: 0,
      });
    } else if (
      interactionMode.current === "moving" &&
      selectedIndex !== null &&
      dragRectSnapshot.current
    ) {
      const dx = pos.x - dragStart.current.x;
      const dy = pos.y - dragStart.current.y;
      const snap = dragRectSnapshot.current;
      setRedactions((prev) =>
        prev.map((r, i) =>
          i === selectedIndex ? { ...r, x: snap.x + dx, y: snap.y + dy } : r,
        ),
      );
    } else if (
      interactionMode.current === "rotating" &&
      selectedIndex !== null &&
      dragRectSnapshot.current
    ) {
      const snap = dragRectSnapshot.current;
      const cx = snap.x + snap.w / 2;
      const cy = snap.y + snap.h / 2;
      const mouseAngle = Math.atan2(pos.x - cx, -(pos.y - cy));
      const newAngle = mouseAngle - dragAngleOffset.current;
      setRedactions((prev) =>
        prev.map((r, i) =>
          i === selectedIndex ? { ...r, angle: newAngle } : r,
        ),
      );
      canvas.style.cursor = "grabbing";
    } else if (
      interactionMode.current === "resizing" &&
      selectedIndex !== null &&
      dragRectSnapshot.current
    ) {
      const newRect = resizeRect(
        dragRectSnapshot.current,
        pos,
        dragEdge.current,
      );
      setRedactions((prev) =>
        prev.map((r, i) => (i === selectedIndex ? newRect : r)),
      );
    }
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const mode = interactionMode.current;
    if (mode === "idle" || !e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();

    if (mode === "drawing") {
      const pos = getCanvasPoint(e);
      const start = dragStart.current;
      const finalRect: RedactionRect = {
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
        angle: 0,
      };

      if (finalRect.w > 3 && finalRect.h > 3) {
        setRedactions((prev) => {
          setSelectedIndex(prev.length);
          return [...prev, finalRect];
        });
      }
      setActiveRect(null);
    }

    interactionMode.current = "idle";
    dragRectSnapshot.current = null;
  };

  const handleCanvasPointerCancel = () => {
    interactionMode.current = "idle";
    setActiveRect(null);
    dragRectSnapshot.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setDisplayScale(loadedImage.naturalWidth / width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [loadedImage]);

  useEffect(() => {
    if (step !== "hide") {
      interactionMode.current = "idle";
      setActiveRect(null);
      setSelectedIndex(null);
    }
  }, [step]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor = loadedImage && canRedact ? "crosshair" : "default";
  }, [loadedImage, canRedact]);

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
      setNotice({
        tone: "error",
        message: "Could not decode that image. Try another file.",
      });
    };
    image.src = imageUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

  const drawCanvas = useCallback(
    (showSelectionUI: boolean) => {
      if (!loadedImage) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = loadedImage.naturalWidth;
      canvas.height = loadedImage.naturalHeight;

      const allRects = activeRect ? [...redactions, activeRect] : redactions;
      renderWatermarkedImage(context, loadedImage, {
        width: canvas.width,
        height: canvas.height,
        watermarked: previewMode === "watermarked",
        grayscale: settings.grayscale,
        redactions: allRects,
        lines,
        opacity: settings.opacity,
        color: settings.color,
        font: fontString,
        angleDegrees: settings.angle,
        offsetX: scaledOffsetX,
        offsetY: scaledOffsetY,
        spacingX: effectiveSpacingX,
        spacingY: effectiveSpacingY,
        fontSize: scaledFontSize,
        lineGap: scaledLineGap,
        stagger: scaledStagger,
      });

      if (previewMode !== "watermarked") return;

      // Layer 4: Selection UI overlay (not exported)
      if (
        showSelectionUI &&
        selectedIndex !== null &&
        selectedIndex < redactions.length
      ) {
        const r = redactions[selectedIndex];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const sf = handleScale;
        const handleDist = r.h / 2 + 20 * sf;
        const handleRadius = 6 * sf;

        context.save();
        context.translate(cx, cy);
        context.rotate(r.angle);

        // Dashed selection border
        context.strokeStyle = "#66e5ff";
        context.lineWidth = 2 * sf;
        context.setLineDash([6 * sf, 4 * sf]);
        context.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);

        // Stem line to handle
        context.setLineDash([]);
        context.lineWidth = 1.5 * sf;
        context.beginPath();
        context.moveTo(0, -r.h / 2);
        context.lineTo(0, -handleDist);
        context.stroke();

        // Rotation handle circle
        context.beginPath();
        context.arc(0, -handleDist, handleRadius, 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
        context.strokeStyle = "#66e5ff";
        context.lineWidth = 2 * sf;
        context.stroke();

        // Stem line to delete handle
        context.beginPath();
        context.moveTo(0, r.h / 2);
        context.lineTo(0, handleDist);
        context.strokeStyle = "rgba(244, 63, 94, 0.6)";
        context.lineWidth = 1.5 * sf;
        context.stroke();

        // Delete handle circle
        context.beginPath();
        context.arc(0, handleDist, handleRadius, 0, Math.PI * 2);
        context.fillStyle = "rgba(244, 63, 94, 0.85)";
        context.fill();
        context.strokeStyle = "rgba(254, 202, 202, 0.7)";
        context.lineWidth = 1.5 * sf;
        context.stroke();

        // × symbol inside delete handle
        const cs = handleRadius * 0.4;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.8 * sf;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(-cs, handleDist - cs);
        context.lineTo(cs, handleDist + cs);
        context.moveTo(cs, handleDist - cs);
        context.lineTo(-cs, handleDist + cs);
        context.stroke();

        context.restore();
      }
    },
    [
      activeRect,
      effectiveSpacingX,
      effectiveSpacingY,
      fontString,
      handleScale,
      lines,
      loadedImage,
      previewMode,
      redactions,
      scaledFontSize,
      scaledLineGap,
      scaledOffsetX,
      scaledOffsetY,
      scaledStagger,
      selectedIndex,
      settings,
    ],
  );

  useEffect(() => {
    drawCanvas(true);
  }, [drawCanvas]);

  const updateSetting = <K extends keyof WatermarkSettings>(
    key: K,
    value: WatermarkSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const loadImageFile = (file: File | undefined) => {
    if (!file) return;

    const validationError = getImageFileValidationError(file);
    if (validationError) {
      setNotice({
        tone: "error",
        message: validationError,
      });
      return;
    }

    const nextUrl = URL.createObjectURL(file);

    setImageUrl(nextUrl);
    setFileName(file.name);
    setRedactions([]);
    setActiveRect(null);
    setSelectedIndex(null);
    interactionMode.current = "idle";
    setPreviewMode("watermarked");
    setStep("hide");
    setNotice({ tone: "info", message: `Loaded ${file.name}` });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openSampleDocument = () => {
    createSampleDocumentFile().then(loadImageFile, () =>
      setNotice({
        tone: "error",
        message: "Could not create the sample document. Try your own image.",
      }),
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadImageFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDropAreaDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!Array.from(event.dataTransfer.types).includes("Files")) return;

    dragDepth.current += 1;
    setIsDragActive(true);
  };

  const handleDropAreaDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
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

  const removeRedaction = (index: number) => {
    setRedactions((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const deleteSelectedRedaction = () => {
    if (selectedIndex === null) return;
    removeRedaction(selectedIndex);
  };

  const undoLastRedaction = () => {
    setRedactions((current) => current.slice(0, -1));
    setSelectedIndex(null);
  };

  const clearRedactions = () => {
    setRedactions([]);
    setSelectedIndex(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedRedaction();
      } else if (e.key === "Escape") {
        setSelectedIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    drawCanvas(false);

    canvas.toBlob(
      (blob) => {
        drawCanvas(true);
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = downloadFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      "image/png",
      0.94,
    );
  };

  const restoreRecommended = () => {
    setSettings({ ...preset.initialSettings });
    setTextMode("suggested");
    setNotice({ tone: "info", message: "Settings reset to default values." });
  };

  const startCompare = () => setPreviewMode("original");
  const endCompare = () => setPreviewMode("watermarked");

  const handleCompareKeyDown = (event: ReactKeyboardEvent) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      startCompare();
    }
  };

  const handleCompareKeyUp = (event: ReactKeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") endCompare();
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      name="wm-file"
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
    />
  );

  const dropHandlers: DropHandlers = {
    onDragEnter: handleDropAreaDragEnter,
    onDragOver: handleDropAreaDragOver,
    onDragLeave: handleDropAreaDragLeave,
    onDrop: handleDropAreaDrop,
  };

  if (!loadedImage) {
    return (
      <>
        {fileInput}
        <input
          ref={cameraInputRef}
          name="wm-camera"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <LandingPage
          isDragActive={isDragActive}
          error={notice?.tone === "error" ? notice.message : null}
          dropHandlers={dropHandlers}
          onChooseFile={openFilePicker}
          onTakePhoto={() => cameraInputRef.current?.click()}
          onTrySample={openSampleDocument}
        />
      </>
    );
  }

  const viewStatus =
    previewMode === "original"
      ? { dot: "bg-amber-500", label: "Original, not protected" }
      : step === "hide"
        ? { dot: "bg-accent", label: "Drag over any detail to cover it" }
        : { dot: "bg-emerald-500", label: "Protected preview" };

  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink lg:h-screen">
      {fileInput}

      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-white px-4 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-ink text-white">
          <BrandIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="font-mono text-xs text-ink-3">
            {imageStats} · stays on this device
          </p>
        </div>

        <nav
          aria-label="Steps"
          className="order-last grid w-full grid-cols-3 gap-1 rounded-xl bg-[#f0f2f5] p-1 md:order-none md:flex md:w-auto"
        >
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cx("step-btn", item.id === step && "is-active")}
              aria-current={item.id === step ? "step" : undefined}
              onClick={() => setStep(item.id)}
            >
              <span className="step-badge">{index + 1}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-1 basis-40 justify-end gap-2">
          <button
            type="button"
            className="action-btn action-btn-quiet"
            onClick={openFilePicker}
          >
            <UploadIcon className="h-4 w-4" />
            Replace
          </button>
          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={handleDownload}
          >
            <DownloadIcon className="h-4 w-4" />
            Download
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Document preview and image drop area"
          className="canvas-dots relative flex min-h-[420px] min-w-0 flex-1 items-center justify-center px-4 pb-24 pt-16 sm:px-10"
          {...dropHandlers}
        >
          <p className="absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_2px_rgba(14,18,24,0.1),0_0_0_1px_rgba(14,18,24,0.05)]">
            <span
              aria-hidden="true"
              className={cx("h-2 w-2 rounded-full", viewStatus.dot)}
            />
            {viewStatus.label}
          </p>

          <canvas
            ref={canvasRef}
            className={cx(
              "block h-auto max-h-[60vh] w-auto min-w-0 max-w-full rounded-[10px] bg-white shadow-[0_30px_60px_-20px_rgba(14,18,24,0.28),0_2px_6px_rgba(14,18,24,0.08)] lg:max-h-[calc(100vh-14rem)]",
              canRedact && "touch-none select-none",
            )}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
          />

          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-accent-soft/90">
              <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm">
                Drop to replace the current image
              </p>
            </div>
          )}

          <div
            role="toolbar"
            aria-label="Preview"
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[14px] bg-ink p-1.5 text-white shadow-[0_12px_32px_-12px_rgba(14,18,24,0.5)]"
          >
            <button
              type="button"
              className={cx(
                "toolbar-btn touch-none select-none",
                previewMode === "original" && "is-active",
              )}
              aria-pressed={previewMode === "original"}
              onPointerDown={startCompare}
              onPointerUp={endCompare}
              onPointerLeave={endCompare}
              onPointerCancel={endCompare}
              onBlur={endCompare}
              onKeyDown={handleCompareKeyDown}
              onKeyUp={handleCompareKeyUp}
            >
              <CompareIcon className="h-[18px] w-[18px]" />
              Hold to compare
            </button>
            {step === "hide" && (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1.5 h-6 w-px bg-white/20"
                />
                <button
                  type="button"
                  className="toolbar-btn"
                  aria-label="Undo last box"
                  disabled={redactions.length === 0}
                  onClick={undoLastRedaction}
                >
                  <UndoIcon className="h-[18px] w-[18px]" />
                </button>
              </>
            )}
          </div>
        </section>

        <aside
          aria-label="Settings"
          className="flex w-full shrink-0 flex-col border-t border-line bg-white p-5 sm:p-6 lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-t-0"
        >
          {notice?.tone === "error" && (
            <p className="notice-error mb-4">{notice.message}</p>
          )}

          {step === "hide" && (
            <HideDetailsPanel
              count={redactions.length}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onRemove={removeRedaction}
              onUndo={undoLastRedaction}
              onClear={clearRedactions}
              onNext={() => setStep("mark")}
            />
          )}

          {step === "mark" && (
            <WatermarkPanel
              settings={settings}
              onSettingChange={updateSetting}
              recipient={recipient}
              onRecipientChange={setRecipient}
              purposeId={purpose.id}
              onPurposeChange={setPurposeId}
              includeDate={includeDate}
              onIncludeDateChange={setIncludeDate}
              textMode={textMode}
              suggestedText={suggestedText}
              onEditText={() => {
                updateSetting("text", suggestedText);
                setTextMode("custom");
              }}
              onUseSuggested={() => setTextMode("suggested")}
              activeStrength={activeStrength}
              onStrengthChange={(strength) =>
                setSettings((current) => ({ ...current, ...strength.values }))
              }
              lineCount={lines.length}
              effectiveSpacingX={effectiveSpacingX}
              effectiveSpacingY={effectiveSpacingY}
              onRestore={restoreRecommended}
              onBack={() => setStep("hide")}
              onNext={() => setStep("export")}
            />
          )}

          {step === "export" && (
            <ExportPanel
              redactionCount={redactions.length}
              watermarkText={watermarkText}
              needsRecipient={textMode === "suggested" && !recipient.trim()}
              fileName={downloadFileName}
              onDownload={handleDownload}
              onGoTo={setStep}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

type StepHeadingProps = {
  step: number;
  title: string;
  description: string;
};

function StepHeading({ step, title, description }: StepHeadingProps) {
  return (
    <div>
      <p className="section-label">Step {step} of 3</p>
      <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1.5 text-sm text-ink-3">{description}</p>
    </div>
  );
}

type HideDetailsPanelProps = {
  count: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onNext: () => void;
};

function HideDetailsPanel({
  count,
  selectedIndex,
  onSelect,
  onRemove,
  onUndo,
  onClear,
  onNext,
}: HideDetailsPanelProps) {
  const boxes = Array.from({ length: count }, (_, index) => index);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepHeading
        step={1}
        title="Hide what they don't need"
        description="Cover anything the company hasn't asked for with a solid black box."
      />

      <p className="rounded-xl border border-line bg-ground px-3.5 py-3 text-sm text-ink-2">
        Drag on the document to add a box. Select a box to move, resize, rotate,
        or delete it.
      </p>

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="field-label">Hidden areas</h3>
          <span className="font-mono text-xs text-ink-3">{count}</span>
        </div>
        {count === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-ink-3">
            Nothing hidden yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {boxes.map((box) => (
              <li
                key={box}
                className={cx(
                  "flex items-center gap-1 rounded-xl border pr-1",
                  selectedIndex === box
                    ? "border-accent bg-accent-soft"
                    : "border-line",
                )}
              >
                <button
                  type="button"
                  className="flex min-h-10 flex-1 items-center gap-2.5 px-3 text-left text-sm"
                  aria-pressed={selectedIndex === box}
                  onClick={() => onSelect(box)}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-[22px] shrink-0 rounded-[3px] bg-[#0b0d10]"
                  />
                  Box {box + 1}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove box ${box + 1}`}
                  onClick={() => onRemove(box)}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3 rounded-xl bg-accent-soft px-3.5 py-3 text-sm text-[#1e3a8a]">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
        <p>
          Many IDs repeat the document number in the code strip along the
          bottom. If you hide the number, cover that strip too.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="action-btn action-btn-quiet"
          disabled={count === 0}
          onClick={onUndo}
        >
          Undo last
        </button>
        <button
          type="button"
          className="action-btn action-btn-quiet"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear all
        </button>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          className="action-btn action-btn-primary w-full py-3"
          onClick={onNext}
        >
          {count === 0 ? "Skip to watermark" : "Next: Watermark"}
        </button>
      </div>
    </div>
  );
}

type WatermarkPanelProps = {
  settings: WatermarkSettings;
  onSettingChange: <K extends keyof WatermarkSettings>(
    key: K,
    value: WatermarkSettings[K],
  ) => void;
  recipient: string;
  onRecipientChange: (recipient: string) => void;
  purposeId: string;
  onPurposeChange: (purposeId: string) => void;
  includeDate: boolean;
  onIncludeDateChange: (includeDate: boolean) => void;
  textMode: TextMode;
  suggestedText: string;
  onEditText: () => void;
  onUseSuggested: () => void;
  activeStrength: StrengthPreset | null;
  onStrengthChange: (strength: StrengthPreset) => void;
  lineCount: number;
  effectiveSpacingX: number;
  effectiveSpacingY: number;
  onRestore: () => void;
  onBack: () => void;
  onNext: () => void;
};

function WatermarkPanel({
  settings,
  onSettingChange,
  recipient,
  onRecipientChange,
  purposeId,
  onPurposeChange,
  includeDate,
  onIncludeDateChange,
  textMode,
  suggestedText,
  onEditText,
  onUseSuggested,
  activeStrength,
  onStrengthChange,
  lineCount,
  effectiveSpacingX,
  effectiveSpacingY,
  onRestore,
  onBack,
  onNext,
}: WatermarkPanelProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepHeading
        step={2}
        title="Who is this for?"
        description="We'll write the watermark for you. Naming who it's for and when makes a leaked copy easy to trace."
      />

      <label className="block">
        <span className="field-label">Company or person</span>
        <input
          type="text"
          name="wm-recipient"
          value={recipient}
          onChange={(event) => onRecipientChange(event.target.value)}
          placeholder="e.g. Acme Bank"
          autoComplete="off"
          className="text-input mt-2"
        />
      </label>

      <fieldset>
        <legend className="field-label">Purpose</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {purposes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx("chip", item.id === purposeId && "is-active")}
              aria-pressed={item.id === purposeId}
              onClick={() => onPurposeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-line bg-ground p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Watermark text
          </span>
          {textMode === "suggested" ? (
            <button type="button" className="link-btn" onClick={onEditText}>
              Edit
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={onUseSuggested}>
              Use suggested
            </button>
          )}
        </div>
        {textMode === "custom" ? (
          <>
            <input
              type="text"
              name="watermark-text"
              aria-label="Watermark text"
              value={settings.text}
              onChange={(event) => onSettingChange("text", event.target.value)}
              className="text-input mt-2"
            />
            <p className="mt-1.5 text-xs text-ink-3">
              Your own text replaces the suggested one.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-ink">
              {suggestedText}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span id="include-date-label" className="text-sm text-ink-2">
                Add today's date
              </span>
              <Switch
                checked={includeDate}
                onChange={onIncludeDateChange}
                labelledBy="include-date-label"
              />
            </div>
          </>
        )}
      </div>

      <fieldset>
        <legend className="field-label">Strength</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {strengthPresets.map((strength) => (
            <button
              key={strength.id}
              type="button"
              className={cx(
                "strength-tile",
                activeStrength?.id === strength.id && "is-active",
              )}
              aria-pressed={activeStrength?.id === strength.id}
              onClick={() => onStrengthChange(strength)}
            >
              <StrengthPreview values={strength.values} />
              {strength.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          {activeStrength
            ? activeStrength.note
            : "Custom settings. Pick a strength to start from a preset."}
        </p>
      </fieldset>

      <details className="group rounded-xl border border-line">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Fine-tune
          <ChevronDownIcon className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-line px-3.5 pb-4 pt-4">
          <FineTuneGroup title="Appearance">
            <RangeControl
              name="wm-opacity"
              label="Visibility"
              hint="Keep document details readable"
              valueLabel={`${(settings.opacity * 100).toFixed(0)}%`}
              min={0.05}
              max={0.6}
              step={0.01}
              value={settings.opacity}
              onChange={(value) => onSettingChange("opacity", value)}
            />
            <RangeControl
              name="wm-font-size"
              label="Text size"
              valueLabel={`${settings.fontSize}px`}
              min={18}
              max={64}
              step={1}
              value={settings.fontSize}
              onChange={(value) => onSettingChange("fontSize", value)}
            />
            <RangeControl
              name="wm-angle"
              label="Direction"
              hint="Angle of the repeated text"
              valueLabel={`${settings.angle}°`}
              min={-60}
              max={60}
              step={1}
              value={settings.angle}
              onChange={(value) => onSettingChange("angle", value)}
            />
            <div className="flex items-center justify-between gap-3">
              <span
                id="wm-color-label"
                className="text-[13px] font-medium text-ink"
              >
                Color
              </span>
              <fieldset
                aria-labelledby="wm-color-label"
                className="flex items-center gap-2"
              >
                {colorSwatches.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    className="color-swatch"
                    style={{ backgroundColor: swatch.hex }}
                    aria-label={swatch.name}
                    aria-pressed={settings.color.toUpperCase() === swatch.hex}
                    onClick={() => onSettingChange("color", swatch.hex)}
                  />
                ))}
                <input
                  name="wm-color"
                  type="color"
                  aria-label="Custom color"
                  value={settings.color}
                  onChange={(event) =>
                    onSettingChange("color", event.target.value)
                  }
                  className="h-7 w-9 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
                />
              </fieldset>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span id="wm-grayscale-label">
                <span className="block text-[13px] font-medium text-ink">
                  Black-and-white document
                </span>
                <span className="block text-xs text-ink-3">
                  Can improve watermark contrast.
                </span>
              </span>
              <Switch
                checked={settings.grayscale}
                onChange={(checked) => onSettingChange("grayscale", checked)}
                labelledBy="wm-grayscale-label"
              />
            </div>
          </FineTuneGroup>

          <FineTuneGroup title="Pattern">
            <RangeControl
              name="wm-spacing-x"
              label="Horizontal gap"
              valueLabel={`${settings.spacingX}px`}
              min={150}
              max={800}
              step={5}
              value={settings.spacingX}
              onChange={(value) => onSettingChange("spacingX", value)}
              footer={`Rendered gap: ${Math.round(effectiveSpacingX)}px`}
            />
            <RangeControl
              name="wm-spacing-y"
              label="Vertical gap"
              valueLabel={`${settings.spacingY}px`}
              min={80}
              max={400}
              step={5}
              value={settings.spacingY}
              onChange={(value) => onSettingChange("spacingY", value)}
              footer={`Rendered gap: ${Math.round(effectiveSpacingY)}px`}
            />
            <RangeControl
              name="wm-stagger"
              label="Alternate-row shift"
              hint="Offsets every other row"
              valueLabel={`${settings.stagger}px`}
              min={-200}
              max={200}
              step={5}
              value={settings.stagger}
              onChange={(value) => onSettingChange("stagger", value)}
            />
            <RangeControl
              name="wm-line-gap"
              label="Wrapped-line spacing"
              valueLabel={`${settings.lineGap}px`}
              min={6}
              max={40}
              step={1}
              value={settings.lineGap}
              disabled={lineCount <= 1}
              onChange={(value) => onSettingChange("lineGap", value)}
              footer={
                lineCount <= 1 ? "Only applies when the text wraps" : undefined
              }
            />
          </FineTuneGroup>

          <FineTuneGroup title="Position">
            <RangeControl
              name="wm-offset-x"
              label="Horizontal position"
              valueLabel={`${settings.offsetX}px`}
              min={-200}
              max={200}
              step={5}
              value={settings.offsetX}
              onChange={(value) => onSettingChange("offsetX", value)}
            />
            <RangeControl
              name="wm-offset-y"
              label="Vertical position"
              valueLabel={`${settings.offsetY}px`}
              min={-200}
              max={200}
              step={5}
              value={settings.offsetY}
              onChange={(value) => onSettingChange("offsetY", value)}
            />
          </FineTuneGroup>

          <button
            type="button"
            className="action-btn action-btn-quiet"
            onClick={onRestore}
          >
            <RotateIcon className="h-4 w-4" /> Restore recommended
          </button>
        </div>
      </details>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          className="action-btn action-btn-quiet py-3"
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          className="action-btn action-btn-primary flex-1 py-3"
          onClick={onNext}
        >
          Next: Export
        </button>
      </div>
    </div>
  );
}

type ExportPanelProps = {
  redactionCount: number;
  watermarkText: string;
  needsRecipient: boolean;
  fileName: string;
  onDownload: () => void;
  onGoTo: (step: Step) => void;
};

function ExportPanel({
  redactionCount,
  watermarkText,
  needsRecipient,
  fileName,
  onDownload,
  onGoTo,
}: ExportPanelProps) {
  const hasWatermark = watermarkText.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepHeading
        step={3}
        title="Ready to send"
        description="A last check before the file leaves your hands."
      />

      <ul className="rounded-xl border border-line">
        {redactionCount > 0 ? (
          <CheckItem tone="done">
            {redactionCount} {redactionCount === 1 ? "detail" : "details"}{" "}
            hidden
          </CheckItem>
        ) : (
          <CheckItem tone="todo">
            Nothing hidden.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoTo("hide")}
            >
              Hide details
            </button>
          </CheckItem>
        )}
        {!hasWatermark ? (
          <CheckItem tone="warn">
            No watermark text.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoTo("mark")}
            >
              Add it
            </button>
          </CheckItem>
        ) : needsRecipient ? (
          <CheckItem tone="warn">
            The watermark says [Company].{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => onGoTo("mark")}
            >
              Add who it's for
            </button>
          </CheckItem>
        ) : (
          <CheckItem tone="done">
            Watermark across the whole image
            <span className="mt-0.5 block text-[13px] text-ink-3">
              {watermarkText}
            </span>
          </CheckItem>
        )}
        <CheckItem tone="done">Location and camera data removed</CheckItem>
        <CheckItem tone="done">Made on this device, nothing uploaded</CheckItem>
      </ul>

      <div>
        <h3 className="field-label">File name</h3>
        <p className="mt-2 break-all rounded-xl border border-line bg-ground px-3 py-2.5 font-mono text-[13px] text-ink">
          {fileName}
        </p>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          className="action-btn action-btn-primary w-full py-3"
          onClick={onDownload}
        >
          <DownloadIcon className="h-4 w-4" />
          Download protected image
        </button>
        <p className="mt-2 text-center text-xs text-ink-3">
          PNG · Processed privately on your device
        </p>
        <button
          type="button"
          className="link-btn mx-auto mt-3 block"
          onClick={() => onGoTo("mark")}
        >
          Back to watermark
        </button>
      </div>
    </div>
  );
}

type CheckItemProps = {
  tone: "done" | "todo" | "warn";
  children: ReactNode;
};

function CheckItem({ tone, children }: CheckItemProps) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-3.5 py-3 text-sm text-ink last:border-b-0">
      <span
        aria-hidden="true"
        className={cx(
          "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-xs font-bold",
          tone === "done" && "bg-[#e7f5ec] text-[#0e6b41]",
          tone === "warn" && "bg-[#fff4e5] text-[#8a4b00]",
          tone === "todo" && "bg-[#f0f2f5] text-ink-3",
        )}
      >
        {tone === "done" ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : tone === "warn" ? (
          "!"
        ) : (
          "–"
        )}
      </span>
      <div className="min-w-0 flex-1 pt-px">{children}</div>
    </li>
  );
}

type StrengthPreviewProps = {
  values: StrengthValues;
};

function StrengthPreview({ values }: StrengthPreviewProps) {
  const barHeight = Math.max(2, Math.round(values.fontSize / 9));
  const rowGap = Math.round(values.spacingY / 22);

  return (
    <span
      aria-hidden="true"
      className="relative block h-10 overflow-hidden rounded-md bg-[#e4eaf1]"
    >
      <span
        className="absolute -inset-x-[40%] -inset-y-[80%] flex -rotate-[32deg] flex-col justify-center"
        style={{ gap: rowGap, opacity: values.opacity }}
      >
        {previewRows.map((row) => (
          <span
            key={row}
            className={cx("strength-bar", row % 2 === 1 && "-ml-2")}
            style={{ height: barHeight }}
          />
        ))}
      </span>
    </span>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
};

function Switch({ checked, onChange, labelledBy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px] transition-colors",
        checked ? "bg-accent" : "bg-[#c4cbd6]",
      )}
    >
      <span
        className={cx(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}

type FineTuneGroupProps = {
  title: string;
  children: ReactNode;
};

function FineTuneGroup({ title, children }: FineTuneGroupProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
        {title}
      </legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
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
  onChange,
}: RangeControlProps) {
  return (
    <label className={cx("block", disabled && "opacity-45")}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="font-mono text-xs text-ink-2">{valueLabel}</span>
      </span>

      {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}

      <input
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-input mt-2"
      />

      {footer && <span className="block text-xs text-ink-3">{footer}</span>}
    </label>
  );
}

export default App;
