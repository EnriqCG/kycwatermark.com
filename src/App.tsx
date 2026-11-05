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
import { contours, rings } from "./guilloche";
import ArrowRightIcon from "./icon/ArrowRightIcon";
import CalendarIcon from "./icon/CalendarIcon";
import CameraIcon from "./icon/CameraIcon";
import CheckIcon from "./icon/CheckIcon";
import ChevronDownIcon from "./icon/ChevronDownIcon";
import CloseIcon from "./icon/CloseIcon";
import CodeIcon from "./icon/CodeIcon";
import CompareIcon from "./icon/CompareIcon";
import CopyIcon from "./icon/CopyIcon";
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
  addWatermarkDate,
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
  recommendedStrength,
  resizeRect,
  type StrengthValues,
  scaleWatermarkSettings,
  screenToCanvas,
  strengthPresets,
  type WatermarkSettings,
  wrapWatermarkText,
} from "./imageLogic";
import Logo from "./Logo";
import {
  createSampleDocumentFile,
  drawSampleDocument,
  loadSampleFonts,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
} from "./rendering/sampleDocument";
import {
  defaultWatermarkSettings,
  getWatermarkFont,
  renderWatermarkPreview,
} from "./rendering/watermarkPreview";
import {
  renderWatermarkedImage,
  WatermarkLayerCache,
} from "./rendering/watermarkRenderer";
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

type Step = "hide" | "mark";
type TextMode = "suggested" | "custom";
type CopyStatus = "idle" | "copying" | "copied";

type Purpose = {
  id: string;
  label: string;
  phrase: string;
};

type StrengthPreset = {
  id: string;
  label: string;
  values: StrengthValues;
};

const watermarkPreset: Preset = {
  title: "Document Watermark",
  description:
    "Add a purpose-specific watermark to ID images without uploading anything. Everything stays local in your browser.",
  hint: "Start with Bold, then adjust visibility and coverage so required details remain readable.",
  downloadName: "watermarked-id.png",
  initialSettings: defaultWatermarkSettings,
};

const steps: ReadonlyArray<{ id: Step; label: string }> = [
  { id: "hide", label: "Hide details" },
  { id: "mark", label: "Watermark" },
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

const colorSwatches = [
  { name: "Graphite", hex: "#353B46" },
  { name: "Blue", hex: "#2F5BEA" },
  { name: "Red", hex: "#B42318" },
  { name: "White", hex: "#FFFFFF" },
] as const;

// Security-print line work, computed once.
const heroContours = contours();
const dropRosette = rings(210, 210, 12, 92, 8.5, 18, 7, 0.3);
const protectedSeal = rings(50, 50, 5, 26, 4, 12, 3.5, 0.5);

// Selection outline drawn on the editor canvas; reads on black boxes and paper.
const selectionColor = "#5fd4a4";

const repositoryUrl = "https://github.com/EnriqCG/kycwatermark.com";

// Copying an image needs the async Clipboard API with ClipboardItem.
const canCopyImage =
  typeof ClipboardItem !== "undefined" &&
  typeof navigator.clipboard?.write === "function";

function App() {
  return <WatermarkStudio preset={watermarkPreset} />;
}

type DropHandlers = Pick<
  DOMAttributes<HTMLElement>,
  "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
>;

type Draft = {
  fileName: string;
  step: Step;
  redactionCount: number;
  watermarkText: string;
  draw: (canvas: HTMLCanvasElement, showSelectionUI: boolean) => void;
};

type LandingPageProps = {
  draft: Draft | null;
  isDragActive: boolean;
  error: string | null;
  dropHandlers: DropHandlers;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  onTrySample: () => void;
  onContinue: () => void;
  onDiscard: () => void;
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
  draft,
  isDragActive,
  error,
  dropHandlers,
  onChooseFile,
  onTakePhoto,
  onTrySample,
  onContinue,
  onDiscard,
}: LandingPageProps) {
  const startRef = useRef<HTMLElement | null>(null);
  const hasDraft = draft !== null;

  // Coming back from the editor: bring the document in progress into view.
  useEffect(() => {
    if (hasDraft) {
      startRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    }
  }, [hasDraft]);

  const sampleText = useMemo(
    () =>
      addWatermarkDate(
        composeWatermarkText(purposes[0].phrase, "Acme Bank"),
        formatWatermarkDate(new Date()),
      ),
    [],
  );

  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-ground text-ink">
      <header className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-[-0.01em] text-ink"
        >
          <Logo className="h-7 w-7" />
          KYCWatermark.com
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
        <section className="relative isolate mx-auto flex max-w-[1200px] flex-col items-center px-4 pt-10 text-center sm:px-6 sm:pt-14">
          <svg
            viewBox="0 0 1600 700"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            className="hero-lines text-accent"
          >
            <path
              d={heroContours}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.8}
              opacity={0.16}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium text-accent-ink sm:text-sm">
            <DeviceIcon className="h-4 w-4" />
            Runs in your browser. No data is sent anywhere.
          </p>
          <h1 className="mt-[22px] max-w-[900px] text-balance font-display text-[clamp(42px,5.6vw,76px)] font-normal leading-[1.02] tracking-[-0.02em]">
            Watermark your ID before you{" "}
            <RedactedPhrase>hand it over.</RedactedPhrase>
          </h1>
          <p className="mt-[22px] max-w-[640px] text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
            Black out what they don't need, stamp who it's for and when, and
            download a copy that's clearly marked for that purpose only.
          </p>
        </section>

        <section
          ref={startRef}
          aria-label="Start"
          className="relative z-10 mx-auto mt-10 max-w-[1200px] px-4 sm:mt-12 sm:px-6"
          {...dropHandlers}
        >
          <div className="flex flex-wrap gap-3 rounded-[26px] border border-line bg-paper p-3 shadow-[0_1px_2px_rgba(16,36,29,0.04),0_24px_48px_-24px_rgba(16,36,29,0.16)]">
            <div
              className={cx(
                "relative isolate flex min-h-[340px] min-w-0 flex-[1_1_400px] flex-col items-center justify-center gap-[22px] overflow-hidden rounded-[18px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors sm:min-h-[460px]",
                isDragActive
                  ? "border-accent bg-accent-soft"
                  : "border-[#a9b6ad] bg-[#f8f9f5]",
              )}
            >
              <svg
                viewBox="0 0 420 420"
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 text-accent"
              >
                <path
                  d={dropRosette}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.7}
                  opacity={0.16}
                />
              </svg>
              {draft && !isDragActive ? (
                <DraftSummary
                  draft={draft}
                  onContinue={onContinue}
                  onChooseFile={onChooseFile}
                  onTakePhoto={onTakePhoto}
                  onDiscard={onDiscard}
                />
              ) : (
                <>
                  <span
                    className={cx(
                      "grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent",
                      !isDragActive &&
                        "shadow-[0_0_0_6px_#f8f9f5,0_0_0_7px_var(--color-accent-soft)]",
                    )}
                  >
                    <UploadIcon className="h-7 w-7" />
                  </span>
                  <div>
                    <h2 className="font-display text-[32px] font-medium leading-[1.1] tracking-[-0.01em]">
                      {isDragActive
                        ? "Drop to open it"
                        : "Drop your document here"}
                    </h2>
                    <p className="mt-1.5 text-[15px] text-ink-3">
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
                    className="link-btn py-1.5 text-[15px] font-medium"
                    onClick={onTrySample}
                  >
                    No document handy? Try it with a sample ID →
                  </button>
                </>
              )}
              {error && (
                <p className="notice-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="paper-lines flex min-w-0 flex-[1.25_1_480px] flex-col justify-center gap-5 rounded-[18px] px-5 py-6 sm:px-8 sm:pb-8 sm:pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="eyebrow">What the company receives</span>
                <span className="inline-flex h-[30px] items-center gap-2 rounded-full border border-line bg-paper px-3 text-[13px] font-medium">
                  <span className="h-[7px] w-3 rounded-[2px] bg-redact" />
                  {draft
                    ? describeHidden(draft.redactionCount)
                    : describeHidden(3)}
                </span>
              </div>
              {draft ? (
                <DraftPreview draw={draft.draw} />
              ) : (
                <SamplePreview text={sampleText} />
              )}
              <p className="font-mono text-[13px] text-ink-2">
                {draft && !draft.watermarkText.trim()
                  ? "No watermark text yet"
                  : `“${draft ? draft.watermarkText : sampleText}”`}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Privacy"
          className="mx-auto mt-16 grid max-w-[1200px] gap-8 px-4 sm:mt-[72px] sm:grid-cols-2 sm:px-6 lg:grid-cols-4"
        >
          {privacyPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-2.5">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper text-accent">
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
          <h2 id="how-title" className="section-title">
            Three steps, all on your device
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            <HowStep
              title="Add your document"
              body="Drop a scan or photo of your ID, or take a picture with your phone's camera."
            >
              <div className="grid h-[116px] w-[180px] place-items-center rounded-xl border-[1.5px] border-dashed border-[#a9b6ad] bg-paper/70">
                <div className="flex flex-col items-center gap-2.5 text-accent">
                  <UploadIcon className="h-[26px] w-[26px]" />
                  <span className="h-1.5 w-[72px] rounded-full bg-[#c9d3cb]" />
                </div>
              </div>
            </HowStep>
            <HowStep
              title="Hide what they don't need"
              body="Drag boxes over your document number, address or anything the company hasn't asked for."
            >
              <MiniCard>
                <span className="h-1.5 w-4/5 rounded-full bg-[#a9b6ad]" />
                <span className="h-1.5 w-3/5 rounded-full bg-[#a9b6ad]" />
                <span className="h-2.5 w-[90%] rounded-[2px] bg-redact" />
                <span className="h-1.5 w-1/2 rounded-full bg-[#a9b6ad]" />
                <span className="h-2.5 w-full rounded-[2px] bg-redact" />
              </MiniCard>
            </HowStep>
            <HowStep
              title="Stamp it and send"
              body="Say who it's for and why. Today's date is added for you, then download it or copy it."
            >
              <MiniCard watermark>
                <span className="h-1.5 w-4/5 rounded-full bg-[#a9b6ad]" />
                <span className="h-1.5 w-3/5 rounded-full bg-[#a9b6ad]" />
                <span className="h-1.5 w-[70%] rounded-full bg-[#a9b6ad]" />
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
            <h2 id="faq-title" className="section-title">
              FAQ
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
        <span className="flex items-center gap-2">
          <Logo compact className="h-4.5 w-4.5" />
          Free · No account · No limits
        </span>
        <span className="font-mono text-[13px]">
          build {__COMMIT_HASH__}
          {import.meta.env.DEV ? "-dev" : ""}
        </span>
      </footer>
    </div>
  );
}

type HowStepProps = {
  title: string;
  body: string;
  children: ReactNode;
};

function HowStep({ title, body, children }: HowStepProps) {
  return (
    <li className="flex flex-col gap-[18px] rounded-[22px] border border-line bg-paper px-4 pb-[26px] pt-4">
      <div
        aria-hidden="true"
        className="paper-lines grid h-[180px] place-items-center rounded-[14px]"
      >
        {children}
      </div>
      <div className="flex flex-col gap-1.5 px-2">
        <h3 className="text-[19px] font-semibold">{title}</h3>
        <p className="text-[15px] text-ink-2">{body}</p>
      </div>
    </li>
  );
}

function describeHidden(count: number) {
  if (count === 0) return "Nothing hidden";
  return `${count} ${count === 1 ? "detail" : "details"} hidden`;
}

type DraftSummaryProps = {
  draft: Draft;
  onContinue: () => void;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  onDiscard: () => void;
};

function DraftSummary({
  draft,
  onContinue,
  onChooseFile,
  onTakePhoto,
  onDiscard,
}: DraftSummaryProps) {
  const stepIndex = steps.findIndex(({ id }) => id === draft.step);

  return (
    <>
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent-ink">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
        In progress
      </span>
      <div className="w-full max-w-sm">
        <h2 className="font-display text-[30px] font-medium leading-[1.1] tracking-[-0.01em]">
          Continue where you left off
        </h2>
        <p
          className="mt-2 truncate text-[15px] font-medium text-ink"
          title={draft.fileName}
        >
          {draft.fileName}
        </p>
        <p className="mt-0.5 text-sm text-ink-3">
          Step {stepIndex + 1} of {steps.length}: {steps[stepIndex].label} ·{" "}
          {describeHidden(draft.redactionCount)}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          className="action-btn action-btn-primary action-btn-lg"
          onClick={onContinue}
        >
          Continue editing
          <ArrowRightIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          className="action-btn action-btn-quiet action-btn-lg"
          onClick={onChooseFile}
        >
          Choose a new file
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
      <p className="max-w-xs text-sm text-ink-3">
        Choosing or dropping a new file replaces the one in progress.
      </p>
      <button
        type="button"
        className="link-btn font-medium text-ink-3"
        onClick={onDiscard}
      >
        Discard this document
      </button>
    </>
  );
}

type DraftPreviewProps = {
  draw: Draft["draw"];
};

function DraftPreview({ draw }: DraftPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, false);
  }, [draw]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Your document as it will be downloaded"
        className="block h-auto max-h-[420px] w-auto min-w-0 max-w-full rounded-[10px] bg-paper shadow-[0_30px_60px_-24px_rgba(16,36,29,0.3),0_2px_6px_rgba(16,36,29,0.08)]"
      />
    </div>
  );
}

type MiniCardProps = {
  watermark?: boolean;
  children: ReactNode;
};

function MiniCard({ watermark = false, children }: MiniCardProps) {
  return (
    <div className="relative flex h-[114px] w-[180px] gap-3 overflow-hidden rounded-[10px] bg-specimen p-3.5 shadow-[0_10px_24px_-12px_rgba(16,36,29,0.3)]">
      <span className="h-[52px] w-10 shrink-0 rounded-[5px] bg-[#c9d3cb]" />
      <div className="flex flex-1 flex-col gap-[7px]">{children}</div>
      {watermark && (
        <PatternPreview className="pointer-events-none absolute inset-0 h-full w-full" />
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

      renderWatermarkPreview(
        context,
        source,
        text,
        defaultWatermarkSettings,
        redactions,
      );
      source.width = source.height = 0;
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
      aria-label="Sample ID card with three details blacked out and dense woven watermark text"
      className="block h-auto w-full rounded-[3%/4.75%] bg-specimen shadow-[0_30px_60px_-24px_rgba(16,36,29,0.3),0_2px_6px_rgba(16,36,29,0.08)]"
    />
  );
}

type RedactedPhraseProps = {
  children: string;
};

// A crosshair drags a black box over the phrase once the page loads, the way
// boxes are drawn in the editor. The text stays readable, knocked out of the
// box, and hovering shows the box's selection outline.
function RedactedPhrase({ children }: RedactedPhraseProps) {
  return (
    <span className="redact">
      {children}
      <span aria-hidden="true" className="redact-mask">
        <span>{children}</span>
      </span>
      <span aria-hidden="true" className="redact-selection">
        <span className="redact-delete">
          <svg
            viewBox="0 0 10 10"
            aria-hidden="true"
            className="h-[0.1em] w-[0.1em]"
          >
            <path
              d="M2 2l6 6M8 2L2 8"
              stroke="#fff"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </svg>
        </span>
      </span>
      <span aria-hidden="true" className="redact-cursor">
        <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true">
          <path
            d="M14 2v9M14 17v9M2 14h9M17 14h9"
            stroke="#fcfcf9"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            d="M14 2v9M14 17v9M2 14h9M17 14h9"
            stroke="#10241d"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
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
  const [customText, setCustomText] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [purposeId, setPurposeId] = useState(purposes[0].id);
  const [includeDate, setIncludeDate] = useState(true);
  const [step, setStep] = useState<Step>("hide");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [fileName, setFileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [patternSeed, setPatternSeed] = useState(0);
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

  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const watermarkLayer = useRef<WatermarkLayerCache | null>(null);
  if (!watermarkLayer.current)
    watermarkLayer.current = new WatermarkLayerCache();
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      watermarkLayer.current?.clear();
      if (alive) setFontRevision((revision) => revision + 1);
    };
    document.fonts.ready.then(() => {
      if (alive) refresh();
    });
    document.fonts.addEventListener("loadingdone", refresh);
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", refresh);
      watermarkLayer.current?.clear();
    };
  }, []);
  useEffect(() => {
    if (!loadedImage) watermarkLayer.current?.clear();
    // Release the previous document even when the next screen has no canvas.
    return () => watermarkLayer.current?.clear();
  }, [loadedImage]);
  const dragDepth = useRef(0);
  const interactionMode = useRef<InteractionMode>("idle");
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRectSnapshot = useRef<RedactionRect | null>(null);
  const dragAngleOffset = useRef(0);
  const dragEdge = useRef<EdgeZone>("top");

  const canRedact = step === "hide" && previewMode === "watermarked";

  const watermarkDate = useMemo(() => formatWatermarkDate(new Date()), []);
  const purpose = purposes.find(({ id }) => id === purposeId) ?? purposes[0];
  const suggestedText = composeWatermarkText(purpose.phrase, recipient);
  const watermarkText = addWatermarkDate(
    textMode === "custom" ? (customText ?? suggestedText) : suggestedText,
    includeDate ? watermarkDate : undefined,
  );

  // Custom text starts from the suggestion the first time, then keeps edits.
  const changeTextMode = (mode: TextMode) => {
    if (mode === "custom" && customText === null) setCustomText(suggestedText);
    setTextMode(mode);
  };
  const activeStrength = findMatchingPreset(settings, strengthPresets);

  const scaleFactor = useMemo(() => {
    if (!loadedImage) return 1;
    return getScaleFactor(loadedImage.naturalWidth, loadedImage.naturalHeight);
  }, [loadedImage]);

  // Selection handles keep a constant on-screen size, larger for fingers.
  const handleScale = displayScale * (coarsePointer ? 1.75 : 1);

  const {
    fontSize: scaledFontSize,
    wovenFontSize: scaledWovenFontSize,
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

  // Font loading changes metrics even when the CSS font string stays identical.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fontRevision invalidates external font metrics.
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
  }, [watermarkText, fontString, maxLineWidth, scaledFontSize, fontRevision]);

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
    const canvas = canvasElement;
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
    const canvas = canvasElement;
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
    const canvas = canvasElement;
    if (!canvas || !loadedImage) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setDisplayScale(loadedImage.naturalWidth / width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasElement, loadedImage]);

  useEffect(() => {
    if (step !== "hide" || !isEditorOpen) {
      interactionMode.current = "idle";
      setActiveRect(null);
      setSelectedIndex(null);
    }
    if (!isEditorOpen) setPreviewMode("watermarked");
  }, [step, isEditorOpen]);

  // The editor gets its own history entry, so Back closes it instead of
  // leaving the site and losing the work in progress.
  useEffect(() => {
    // The page sets its own scroll position when switching views.
    window.history.scrollRestoration = "manual";
    // A reload keeps the editor's history entry, but not the document in it.
    if (window.history.state?.editor === true) {
      window.history.replaceState(null, "");
    }
    const handlePopState = (event: PopStateEvent) => {
      setIsEditorOpen(event.state?.editor === true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const showEditor = isEditorOpen && loadedImage !== null;

  useEffect(() => {
    if (showEditor) window.scrollTo({ top: 0, behavior: "instant" });
  }, [showEditor]);

  useEffect(() => {
    const canvas = canvasElement;
    if (!canvas) return;
    canvas.style.cursor = loadedImage && canRedact ? "crosshair" : "default";
  }, [canvasElement, loadedImage, canRedact]);

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

  // Draws into the editor canvas, or into the landing page's draft preview.
  const drawDocument = useCallback(
    (
      canvas: HTMLCanvasElement,
      showSelectionUI: boolean,
      mode = previewMode,
    ) => {
      if (!loadedImage) return;
      const context = canvas.getContext("2d");
      if (!context) return;

      if (canvas.width !== loadedImage.naturalWidth)
        canvas.width = loadedImage.naturalWidth;
      if (canvas.height !== loadedImage.naturalHeight)
        canvas.height = loadedImage.naturalHeight;

      // An export can resume after fonts finish loading, before React has
      // committed the new measured preview. Measure its Straight wrapping now.
      let renderLines = lines;
      let spacing = {
        spacingX: effectiveSpacingX,
        spacingY: effectiveSpacingY,
      };
      if (!showSelectionUI && settings.pattern === "text") {
        context.font = fontString;
        const layout = wrapWatermarkText(
          watermarkText,
          maxLineWidth,
          (line) => context.measureText(line).width,
        );
        renderLines = layout.lines;
        spacing = getEffectiveWatermarkSpacing(
          layout.lines,
          layout.textWidth,
          scaledFontSize,
          scaledSpacingX,
          scaledSpacingY,
          scaledLineGap,
        );
      }

      const allRects = activeRect ? [...redactions, activeRect] : redactions;
      renderWatermarkedImage(
        context,
        loadedImage,
        {
          width: canvas.width,
          height: canvas.height,
          watermarked: mode === "watermarked",
          grayscale: settings.grayscale,
          redactions: allRects,
          lines: renderLines,
          text: watermarkText,
          fontRevision,
          opacity: settings.opacity,
          color: settings.color,
          font: fontString,
          angleDegrees: settings.angle,
          offsetX: scaledOffsetX,
          offsetY: scaledOffsetY,
          spacingX: spacing.spacingX,
          spacingY: spacing.spacingY,
          fontSize: scaledFontSize,
          lineGap: scaledLineGap,
          stagger: scaledStagger,
          pattern: settings.pattern,
          textureDensity: settings.textureDensity,
          wovenFontSize: scaledWovenFontSize,
          waveFrequency: settings.waveFrequency,
          letterWarp: settings.letterWarp,
          patternSeed,
        },
        watermarkLayer.current ?? undefined,
      );

      if (mode !== "watermarked") return;

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
        context.strokeStyle = selectionColor;
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
        context.fillStyle = "#fcfcf9";
        context.fill();
        context.strokeStyle = selectionColor;
        context.lineWidth = 2 * sf;
        context.stroke();

        // Stem line to delete handle
        context.beginPath();
        context.moveTo(0, r.h / 2);
        context.lineTo(0, handleDist);
        context.strokeStyle = "rgba(194, 65, 47, 0.6)";
        context.lineWidth = 1.5 * sf;
        context.stroke();

        // Delete handle circle
        context.beginPath();
        context.arc(0, handleDist, handleRadius, 0, Math.PI * 2);
        context.fillStyle = "#c2412f";
        context.fill();
        context.strokeStyle = "rgba(252, 252, 249, 0.75)";
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
      fontRevision,
      maxLineWidth,
      scaledSpacingX,
      scaledSpacingY,
      watermarkText,
      handleScale,
      lines,
      loadedImage,
      patternSeed,
      previewMode,
      redactions,
      scaledFontSize,
      scaledWovenFontSize,
      scaledLineGap,
      scaledOffsetX,
      scaledOffsetY,
      scaledStagger,
      selectedIndex,
      settings,
    ],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (canvasElement) drawDocument(canvasElement, true);
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasElement, drawDocument]);

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

    setPatternSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
    setImageUrl(nextUrl);
    setFileName(file.name);
    setRedactions([]);
    setActiveRect(null);
    setSelectedIndex(null);
    interactionMode.current = "idle";
    setPreviewMode("watermarked");
    setStep("hide");
    setNotice({ tone: "info", message: `Loaded ${file.name}` });
    openEditor();
  };

  const openEditor = () => {
    if (!isEditorOpen) window.history.pushState({ editor: true }, "");
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    if (window.history.state?.editor === true) {
      window.history.back();
    } else {
      setIsEditorOpen(false);
    }
  };

  const discardDocument = () => {
    setImageUrl("");
    setFileName("");
    setRedactions([]);
    setStep("hide");
    setNotice(null);
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

  const renderExportBlob = async () => {
    await document.fonts.ready;
    return new Promise<Blob>((resolve, reject) => {
      if (!loadedImage) {
        reject(new Error("No document is open."));
        return;
      }

      // Export independently of the editor's comparison / selection state.
      // Never redraw or encode the preview canvas, which may show the original.
      const canvas = document.createElement("canvas");
      try {
        drawDocument(canvas, false, "watermarked");
        canvas.toBlob((blob) => {
          canvas.width = canvas.height = 0;
          if (blob) resolve(blob);
          else reject(new Error("Could not export the image."));
        }, "image/png");
      } catch (error) {
        canvas.width = canvas.height = 0;
        reject(error);
      }
    });
  };

  const handleDownload = () => {
    renderExportBlob().then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = downloadFileName;
        anchor.click();
        URL.revokeObjectURL(url);
        setNotice(null);
      },
      () =>
        setNotice({
          tone: "error",
          message: "Could not export the image. Try again.",
        }),
    );
  };

  const handleCopy = () => {
    setCopyStatus("copying");
    // Safari only allows the write if it starts inside the click, so the
    // image goes in as a promise instead of being rendered first.
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": renderExportBlob() })])
      .then(
        () => {
          setCopyStatus("copied");
          setNotice(null);
        },
        () => {
          setCopyStatus("idle");
          setNotice({
            tone: "error",
            message:
              "Your browser didn't allow copying the image. Use Download instead.",
          });
        },
      );
  };

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const restoreRecommended = () => {
    setSettings({ ...preset.initialSettings });
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

  if (!loadedImage || !isEditorOpen) {
    const draft: Draft | null = loadedImage
      ? {
          fileName,
          step,
          redactionCount: redactions.length,
          watermarkText,
          draw: drawDocument,
        }
      : null;

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
          draft={draft}
          isDragActive={isDragActive}
          error={notice?.tone === "error" ? notice.message : null}
          dropHandlers={dropHandlers}
          onChooseFile={openFilePicker}
          onTakePhoto={() => cameraInputRef.current?.click()}
          onTrySample={openSampleDocument}
          onContinue={openEditor}
          onDiscard={discardDocument}
        />
      </>
    );
  }

  const viewStatus =
    previewMode === "original"
      ? { dot: "bg-[#c98a1b]", label: "Original, not protected" }
      : step === "hide"
        ? { dot: "bg-accent", label: "Drag over any detail to cover it" }
        : { dot: null, label: "Protected preview" };

  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink lg:h-screen">
      {fileInput}

      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-paper px-4 py-2.5">
        <button
          type="button"
          className="icon-btn h-10 w-10 border border-line text-ink-2"
          aria-label="Close editor"
          title="Close and go back to the start page"
          onClick={closeEditor}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="font-mono text-xs text-ink-3">{imageStats}</p>
        </div>

        <nav
          aria-label="Steps"
          className="order-last grid w-full grid-cols-2 gap-1 rounded-full bg-well p-1 shadow-[inset_0_0_0_1px_#dde3db] md:order-none md:flex md:w-auto"
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
          className="paper-lines relative flex min-h-[420px] min-w-0 flex-1 items-center justify-center px-4 pb-24 pt-16 sm:px-10"
          {...dropHandlers}
        >
          <p className="absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-paper py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-ink shadow-[0_1px_2px_rgba(16,36,29,0.1),0_0_0_1px_rgba(16,36,29,0.06)]">
            {viewStatus.dot ? (
              <span
                aria-hidden="true"
                className={cx("h-2 w-2 rounded-full", viewStatus.dot)}
              />
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 100 100"
                aria-hidden="true"
                className="text-seal"
              >
                <path
                  d={protectedSeal}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={5}
                />
                <circle cx="50" cy="50" r="14" fill="currentColor" />
              </svg>
            )}
            {viewStatus.label}
          </p>

          <canvas
            ref={setCanvasElement}
            className={cx(
              "block h-auto max-h-[60vh] w-auto min-w-0 max-w-full rounded-[10px] bg-paper shadow-[0_30px_60px_-20px_rgba(16,36,29,0.28),0_2px_6px_rgba(16,36,29,0.08)] lg:max-h-[calc(100vh-14rem)]",
              canRedact && "touch-none select-none",
            )}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
          />

          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-accent-soft/90">
              <p className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm">
                Drop to replace the current image
              </p>
            </div>
          )}

          <div
            role="toolbar"
            aria-label="Preview"
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-ink p-1.5 text-paper shadow-[0_12px_32px_-12px_rgba(16,36,29,0.5)]"
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
                  className="mx-1.5 h-6 w-px bg-paper/20"
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
          className="flex w-full shrink-0 flex-col border-t border-line bg-paper p-5 sm:p-6 lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-t-0"
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
              dateLabel={watermarkDate}
              textMode={textMode}
              onTextModeChange={changeTextMode}
              suggestedText={suggestedText}
              customText={customText ?? suggestedText}
              onCustomTextChange={setCustomText}
              activeStrength={activeStrength}
              onStrengthChange={(strength) =>
                setSettings((current) => ({ ...current, ...strength.values }))
              }
              lineCount={lines.length}
              effectiveSpacingX={effectiveSpacingX}
              effectiveSpacingY={effectiveSpacingY}
              onRestore={restoreRecommended}
              needsRecipient={textMode === "suggested" && !recipient.trim()}
              copyStatus={copyStatus}
              onBack={() => setStep("hide")}
              onDownload={handleDownload}
              onCopy={handleCopy}
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
  description?: string;
};

function StepHeading({ step, title, description }: StepHeadingProps) {
  return (
    <div>
      <p className="section-label">
        Step {step} of {steps.length}
      </p>
      <h2 className="mt-1.5 font-display text-[29px] font-medium leading-[1.12] tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {description && <p className="mt-2 text-sm text-ink-3">{description}</p>}
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

      <p className="rounded-[14px] border border-line bg-ground px-3.5 py-3 text-sm text-ink-2">
        Drag on the document to add a box. Select a box to move, resize, rotate,
        or delete it.
      </p>

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="field-label">Hidden areas</h3>
          <span className="font-mono text-xs text-ink-3">{count}</span>
        </div>
        {count === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-sm text-ink-3">
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
                    ? "border-accent bg-accent-soft font-semibold"
                    : "border-line",
                )}
              >
                <button
                  type="button"
                  className="flex min-h-11 flex-1 items-center gap-2.5 px-3 text-left text-sm"
                  aria-pressed={selectedIndex === box}
                  onClick={() => onSelect(box)}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-[22px] shrink-0 rounded-[3px] bg-redact"
                  />
                  Box {box + 1}
                </button>
                <button
                  type="button"
                  className={cx(
                    "icon-btn",
                    selectedIndex === box && "text-accent-ink",
                  )}
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

      <div className="flex gap-3 rounded-[14px] bg-accent-soft px-3.5 py-3 text-sm text-accent-ink">
        <InfoIcon className="mt-px h-5 w-5 shrink-0" />
        <p>
          Many IDs repeat the document number in the code strip along the
          bottom. If you hide the number, cover that strip too.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="action-btn action-btn-quiet h-11"
          disabled={count === 0}
          onClick={onUndo}
        >
          Undo last
        </button>
        <button
          type="button"
          className="action-btn action-btn-quiet h-11"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear all
        </button>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          className="action-btn action-btn-primary action-btn-lg w-full text-[15px]"
          onClick={onNext}
        >
          {count === 0 ? "Skip to watermark" : "Next: Watermark"}
          <ArrowRightIcon className="h-[18px] w-[18px]" />
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
  dateLabel: string;
  textMode: TextMode;
  onTextModeChange: (mode: TextMode) => void;
  suggestedText: string;
  customText: string;
  onCustomTextChange: (text: string) => void;
  activeStrength: StrengthPreset | null;
  onStrengthChange: (strength: StrengthPreset) => void;
  lineCount: number;
  effectiveSpacingX: number;
  effectiveSpacingY: number;
  onRestore: () => void;
  needsRecipient: boolean;
  copyStatus: CopyStatus;
  onBack: () => void;
  onDownload: () => void;
  onCopy: () => void;
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
  dateLabel,
  textMode,
  onTextModeChange,
  suggestedText,
  customText,
  onCustomTextChange,
  activeStrength,
  onStrengthChange,
  lineCount,
  effectiveSpacingX,
  effectiveSpacingY,
  onRestore,
  needsRecipient,
  copyStatus,
  onBack,
  onDownload,
  onCopy,
}: WatermarkPanelProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepHeading step={2} title="Add a watermark" />

      <section aria-labelledby="text-label" className="flex flex-col gap-3">
        <h3 id="text-label" className="field-label">
          Watermark text
        </h3>
        <div className="segmented">
          <button
            type="button"
            className={cx(
              "segmented-btn",
              textMode === "suggested" && "is-active",
            )}
            aria-pressed={textMode === "suggested"}
            onClick={() => onTextModeChange("suggested")}
          >
            Help me write it
          </button>
          <button
            type="button"
            className={cx(
              "segmented-btn",
              textMode === "custom" && "is-active",
            )}
            aria-pressed={textMode === "custom"}
            onClick={() => onTextModeChange("custom")}
          >
            Custom
          </button>
        </div>

        {textMode === "suggested" ? (
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="field-sublabel">Who is it for?</span>
              <input
                type="text"
                name="wm-recipient"
                value={recipient}
                onChange={(event) => onRecipientChange(event.target.value)}
                placeholder="Company or person, e.g. Acme Bank"
                autoComplete="off"
                className="text-input mt-2"
              />
            </label>

            <fieldset>
              <legend className="field-sublabel">What is it for?</legend>
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

            <div className="rounded-[14px] border border-line bg-ground px-3.5 py-3 shadow-[inset_0_0_0_3px_var(--color-ground),inset_0_0_0_4px_#e1e6df]">
              <p className="text-xs text-ink-3">Your watermark reads</p>
              <p className="mt-1 text-[15px] font-medium leading-snug text-ink">
                {suggestedText}
              </p>
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="field-sublabel">Your text</span>
            <textarea
              name="wm-custom-text"
              rows={3}
              value={customText}
              onChange={(event) => onCustomTextChange(event.target.value)}
              placeholder="e.g. Only for Acme Bank"
              className="text-input mt-2 resize-y leading-snug"
            />
            <span className="mt-2 block text-[13px] text-ink-3">
              Say who it's for and why. Short text repeats more cleanly.
            </span>
          </label>
        )}
      </section>

      <div className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-3">
        <CalendarIcon className="h-5 w-5 shrink-0 text-ink-2" />
        <div className="min-w-0 flex-1">
          <p id="include-date-label" className="text-sm font-medium text-ink">
            Add today's date
          </p>
          <p className="text-[13px] text-ink-3">
            {includeDate ? dateLabel : "No date on the watermark"}
          </p>
        </div>
        <Switch
          checked={includeDate}
          onChange={onIncludeDateChange}
          labelledBy="include-date-label"
        />
      </div>

      <fieldset>
        <legend className="field-label">Pattern</legend>
        <div className="segmented mt-2">
          {(["woven", "text"] as const).map((pattern) => (
            <button
              key={pattern}
              type="button"
              className={cx(
                "segmented-btn",
                settings.pattern === pattern && "is-active",
              )}
              aria-pressed={settings.pattern === pattern}
              onClick={() => onSettingChange("pattern", pattern)}
            >
              {pattern === "woven" ? "Woven" : "Straight text"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          {settings.pattern === "woven"
            ? "Your text forms dense, flowing lines across the document."
            : "Larger repeating text with more open space between marks."}
        </p>
      </fieldset>

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
              <StrengthPreview
                values={strength.values}
                pattern={settings.pattern}
              />
              {strength.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          Bold is recommended. Check that required details are still readable.
        </p>
      </fieldset>

      <details className="group rounded-[14px] border border-line">
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
              valueLabel={`${settings.pattern === "woven" ? settings.wovenFontSize : settings.fontSize}px`}
              min={settings.pattern === "woven" ? 6 : 18}
              max={settings.pattern === "woven" ? 22 : 64}
              step={settings.pattern === "woven" ? 0.5 : 1}
              value={
                settings.pattern === "woven"
                  ? settings.wovenFontSize
                  : settings.fontSize
              }
              onChange={(value) =>
                onSettingChange(
                  settings.pattern === "woven" ? "wovenFontSize" : "fontSize",
                  value,
                )
              }
            />
            <RangeControl
              name="wm-angle"
              label="Direction"
              hint="Angle of the text and curves"
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
                  className="h-7 w-9 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
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
            {settings.pattern === "woven" && (
              <>
                <RangeControl
                  name="wm-texture-density"
                  label="Text density"
                  hint="Bring the wavy text lines closer together"
                  valueLabel={`${Math.round(settings.textureDensity * 100)}%`}
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={settings.textureDensity}
                  onChange={(value) => onSettingChange("textureDensity", value)}
                />
                <RangeControl
                  name="wm-wave-frequency"
                  label="Wave frequency"
                  hint="More ripples along each line"
                  valueLabel={`${settings.waveFrequency}×`}
                  min={1}
                  max={5}
                  step={0.25}
                  value={settings.waveFrequency}
                  onChange={(value) => onSettingChange("waveFrequency", value)}
                />
                <RangeControl
                  name="wm-letter-warp"
                  label="Letter variation"
                  hint="Bend and shape letters; vary the flow gradually"
                  valueLabel={`${Math.round(settings.letterWarp * 100)}%`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.letterWarp}
                  onChange={(value) => onSettingChange("letterWarp", value)}
                />
              </>
            )}
            {settings.pattern === "text" && (
              <>
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
                  label="Row shift"
                  hint="Offsets each row from the one above"
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
                    lineCount <= 1
                      ? "Only applies when the text wraps"
                      : undefined
                  }
                />
              </>
            )}
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

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {needsRecipient && (
          <p className="rounded-[10px] bg-[#fbf1de] px-3 py-2 text-[13px] text-[#7a4a06]">
            The watermark still says [Company]. Add who it's for above.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className="action-btn action-btn-quiet h-[50px] px-5 text-[15px]"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="button"
            className="action-btn action-btn-primary h-[50px] flex-1 text-[15px] [--btn-ring:3px]"
            onClick={onDownload}
          >
            <DownloadIcon className="h-4 w-4" />
            Download
          </button>
        </div>
        {canCopyImage && (
          <button
            type="button"
            className="action-btn action-btn-outline h-11"
            disabled={copyStatus === "copying"}
            onClick={onCopy}
          >
            {copyStatus === "copied" ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            <span aria-live="polite">
              {copyStatus === "copying"
                ? "Copying…"
                : copyStatus === "copied"
                  ? "Copied"
                  : "Copy to clipboard"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

type StrengthPreviewProps = {
  values: StrengthValues;
  pattern: WatermarkSettings["pattern"];
};

// The thumbnails show a crop of the real pattern, not decorative stand-ins.
function StrengthPreview({ values, pattern }: StrengthPreviewProps) {
  return (
    <PatternPreview
      values={values}
      pattern={pattern}
      detail
      className="block h-10 w-full overflow-hidden rounded-lg bg-specimen"
    />
  );
}

function PatternPreview({
  values = recommendedStrength.values,
  pattern = "woven",
  detail = false,
  className,
}: {
  values?: StrengthValues;
  pattern?: WatermarkSettings["pattern"];
  detail?: boolean;
  className: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      const context = canvasRef.current?.getContext("2d");
      if (cancelled || !context) return;
      const source = document.createElement("canvas");
      const rendered = document.createElement("canvas");
      source.width = rendered.width = 1000;
      source.height = rendered.height = 630;
      const drawing = rendered.getContext("2d");
      try {
        if (!drawing) return;
        renderWatermarkPreview(drawing, source, "Only for Acme Bank", {
          ...defaultWatermarkSettings,
          ...values,
          pattern,
        });
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        if (detail && pattern === "woven") {
          context.drawImage(rendered, 380, 243, 240, 144, 0, 0, 720, 432);
        } else {
          context.drawImage(rendered, 0, 0, 720, 432);
        }
      } finally {
        source.width = source.height = rendered.width = rendered.height = 0;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [values, pattern, detail]);
  return (
    <span aria-hidden="true" className={className}>
      <canvas
        ref={canvasRef}
        width={720}
        height={432}
        className="block h-full w-full"
      />
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
        "inline-flex h-7 w-[46px] shrink-0 items-center rounded-full p-[3px] transition-colors",
        checked ? "bg-accent" : "bg-[#c3cdc5]",
      )}
    >
      <span
        className={cx(
          "h-[22px] w-[22px] rounded-full bg-paper shadow-[0_1px_2px_rgba(16,36,29,0.25)] transition-transform",
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
      <legend className="font-mono text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-3">
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
        aria-valuetext={valueLabel}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-input mt-2"
      />

      {footer && <span className="block text-xs text-ink-3">{footer}</span>}
    </label>
  );
}

export default App;
