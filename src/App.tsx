import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "./cx";
import DownloadIcon from "./icon/DownloadIcon";
import ExternalLinkIcon from "./icon/ExternalLinkIcon";
import GitHubIcon from "./icon/GithubIcon";
import NoUploadIcon from "./icon/NoUploadIcon";
import PatternIcon from "./icon/PatternIcon";
import RotateIcon from "./icon/RotateIcon";
import TypeIcon from "./icon/TypeIcon";
import TypographyIcon from "./icon/TypographyIcon";
import UploadIcon from "./icon/UploadIcon";
import {
  type EdgeZone,
  edgeCursor,
  findEdgeZone,
  getDownloadFileName,
  getEffectiveWatermarkSpacing,
  getImageFileValidationError,
  getScaleFactor,
  pointInRect,
  pointOnDeleteHandle,
  pointOnRotationHandle,
  type RedactionRect,
  resizeRect,
  scaleWatermarkSettings,
  screenToCanvas,
  type WatermarkSettings,
  wrapWatermarkText,
} from "./imageLogic";
import { renderWatermarkedImage } from "./rendering/watermarkRenderer";

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

function App() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
      <header className="animate-rise-in flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">KYC Watermark</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Protect a document before sharing it
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <TrustPill
            icon={<GitHubIcon className="h-4 w-4" />}
            text="Open source"
            href="https://github.com/EnriqCG/kycwatermark.com"
            trailingIcon={<ExternalLinkIcon className="h-3.5 w-3.5" />}
          />
          <TrustPill
            icon={<NoUploadIcon className="h-4 w-4" />}
            text="Private · No uploads"
          />
        </div>
      </header>

      <main className="mt-6">
        <WatermarkStudio preset={watermarkPreset} />
      </main>

      <section className="content-card mt-14 px-5 py-7 sm:px-8 sm:py-9">
        <h2 className="section-label">About</h2>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">
          What is KYCWatermark.com
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          KYCWatermark.com is a free, open-source tool that adds visible
          watermarks to identity documents before you share them. All processing
          happens locally in your browser. Your files are never uploaded to any
          server.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Why watermark your documents?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          When you share ID documents for verification (KYC), adding a
          purpose-specific watermark like "Only for verification at [Company
          Name]" helps prevent misuse if the document is leaked or forwarded.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          How it works
        </h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Upload or drag your ID image into the website</li>
          <li>Optionally redact parts of your document</li>
          <li>Customize the watermark text, opacity, angle, and spacing</li>
          <li>Download the watermarked image as a PNG</li>
        </ol>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Is my data safe?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Yes. Everything runs entirely in your browser. Your image never leaves
          your device, and no data is sent to any server.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Is this really free?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Yes. There are no fees, no accounts, and no usage limits. The project
          is open source and can be publicly audited in{" "}
          <a
            href="https://github.com/EnriqCG/kycwatermark.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
          >
            GitHub
          </a>
          .
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          What file types can I use?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          PNG, JPG, WebP, and HEIC images.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Can I use this on my phone?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Yes. The tool works in any modern browser on mobile, tablet, or
          desktop. No app installation is needed.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          What is the redact feature for?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          It lets you draw black rectangles over sensitive fields (like ID
          numbers or addresses) before applying the watermark, so you only share
          what is strictly necessary.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Who built this and why?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          It was built because sharing raw, unmarked identity documents online
          is risky. The goal is to give everyone a simple, privacy-first way to
          protect their documents before sending them out.
        </p>

        <h3 className="mt-7 text-xl font-semibold text-slate-950">
          Can I use this for non-KYC documents?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Absolutely. You can watermark contracts, certificates, invoices, or
          any image you want to protect from unauthorized reuse.
        </p>
      </section>

      <footer className="mt-8 text-center text-xs text-slate-400">
        {__COMMIT_HASH__}
        {import.meta.env.DEV ? "-dev" : ""}
      </footer>
    </div>
  );
}

type WatermarkStudioProps = {
  preset: Preset;
};

function WatermarkStudio({ preset }: WatermarkStudioProps) {
  const [settings, setSettings] = useState<WatermarkSettings>({
    ...preset.initialSettings,
  });
  const [fileName, setFileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("watermarked");
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [redactEnabled, setRedactEnabled] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [redactions, setRedactions] = useState<RedactionRect[]>([]);
  const [activeRect, setActiveRect] = useState<RedactionRect | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const interactionMode = useRef<InteractionMode>("idle");
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRectSnapshot = useRef<RedactionRect | null>(null);
  const dragAngleOffset = useRef(0);
  const dragEdge = useRef<EdgeZone>("top");

  const scaleFactor = useMemo(() => {
    if (!loadedImage) return 1;
    return getScaleFactor(loadedImage.naturalWidth, loadedImage.naturalHeight);
  }, [loadedImage]);

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
    () =>
      `600 ${scaledFontSize}px "Avenir Next", "Sora", "Manrope", "Trebuchet MS", "Segoe UI", sans-serif`,
    [scaledFontSize],
  );

  const maxLineWidth = useMemo(
    () => scaledSpacingX - scaledFontSize * 0.6,
    [scaledSpacingX, scaledFontSize],
  );

  const { lines, textWidth } = useMemo(() => {
    const text = settings.text.trim();
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
  }, [settings.text, fontString, maxLineWidth, scaledFontSize]);

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
    return getDownloadFileName(fileName, preset.downloadName);
  }, [fileName, preset.downloadName]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
      if (pointOnRotationHandle(px, py, r, scaleFactor)) {
        return { index: selectedIndex, zone: "handle" };
      }
      if (pointOnDeleteHandle(px, py, r, scaleFactor)) {
        return { index: selectedIndex, zone: "delete" };
      }
      const edge = findEdgeZone(px, py, r, scaleFactor);
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

  // --- Mouse handlers ---

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!redactEnabled || !loadedImage) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getCanvasPoint(e);
    const hit = findHitTarget(pos.x, pos.y);

    if (hit?.zone === "delete") {
      deleteSelectedRedaction();
      return;
    } else if (hit?.zone === "handle") {
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

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !redactEnabled || !loadedImage) return;

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

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const mode = interactionMode.current;
    if (mode === "idle") return;
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

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (interactionMode.current !== "idle") {
        interactionMode.current = "idle";
        setActiveRect(null);
        dragRectSnapshot.current = null;
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    if (!redactEnabled) {
      interactionMode.current = "idle";
      setActiveRect(null);
      setSelectedIndex(null);
    }
  }, [redactEnabled]);

  useEffect(() => {
    if (!advancedOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdvancedOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [advancedOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor =
      loadedImage && redactEnabled ? "crosshair" : "default";
  }, [loadedImage, redactEnabled]);

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
        const sf = scaleFactor;
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
      lines,
      loadedImage,
      previewMode,
      redactions,
      scaleFactor,
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
    setRedactEnabled(false);
    setNotice({ tone: "info", message: `Loaded ${file.name}` });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
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

  const deleteSelectedRedaction = () => {
    if (selectedIndex === null) return;
    setRedactions((prev) => prev.filter((_, i) => i !== selectedIndex));
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

  const resetSettings = () => {
    setSettings({ ...preset.initialSettings });
    setRedactions([]);
    setActiveRect(null);
    setSelectedIndex(null);
    interactionMode.current = "idle";
    setPreviewMode("watermarked");
    setRedactEnabled(false);
    setNotice({ tone: "info", message: "Settings reset to default values." });
  };

  return (
    <section>
      <input
        ref={fileInputRef}
        name="wm-file"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!loadedImage ? (
        <section className="content-card overflow-hidden p-4 sm:p-6">
          <button
            type="button"
            className={cx(
              "relative grid min-h-[390px] w-full place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition sm:min-h-[480px]",
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/40",
            )}
            onClick={openFilePicker}
            onDragEnter={handleDropAreaDragEnter}
            onDragOver={handleDropAreaDragOver}
            onDragLeave={handleDropAreaDragLeave}
            onDrop={handleDropAreaDrop}
          >
            <div className="max-w-md">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                <UploadIcon className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">
                Choose a document
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Select an image or drag it here to add a protective watermark.
              </p>
              <span className="action-btn action-btn-primary mt-6">
                Select image
              </span>
              <p className="mt-4 text-xs text-slate-500">
                PNG, JPG, WebP or HEIC
              </p>
              <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                <NoUploadIcon className="h-4 w-4" />
                Your document never leaves this device
              </p>
            </div>
          </button>
          {notice?.tone === "error" && (
            <p className="notice-error mt-3">{notice.message}</p>
          )}
        </section>
      ) : (
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
          <section className="content-card min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="section-label">Document preview</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-700">
                  {fileName}{" "}
                  <span className="text-slate-400">· {imageStats}</span>
                </p>
              </div>
              <fieldset className="segmented-control">
                <legend className="sr-only">Preview mode</legend>
                <button
                  type="button"
                  onClick={() => setPreviewMode("original")}
                  className={cx(previewMode === "original" && "is-active")}
                  aria-pressed={previewMode === "original"}
                  disabled={redactEnabled}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("watermarked")}
                  className={cx(previewMode === "watermarked" && "is-active")}
                  aria-pressed={previewMode === "watermarked"}
                >
                  Protected
                </button>
              </fieldset>
            </div>

            <section
              aria-label="Document preview and image drop area"
              className={cx(
                "relative mt-4 grid min-h-[330px] w-full place-items-center overflow-hidden rounded-2xl border bg-slate-100 p-3 transition sm:min-h-[500px]",
                isDragActive ? "drop-area-active" : "border-slate-200",
              )}
              onDragEnter={handleDropAreaDragEnter}
              onDragOver={handleDropAreaDragOver}
              onDragLeave={handleDropAreaDragLeave}
              onDrop={handleDropAreaDrop}
            >
              <canvas
                ref={canvasRef}
                className="max-h-[68vh] w-full rounded-lg bg-white object-contain shadow-sm"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
              {isDragActive && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-blue-100/90">
                  <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
                    Drop to replace the current image
                  </p>
                </div>
              )}
            </section>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="action-btn action-btn-quiet"
                onClick={openFilePicker}
              >
                <UploadIcon className="h-4 w-4" />
                Change image
              </button>
              <button
                type="button"
                className={cx(
                  "action-btn",
                  redactEnabled
                    ? "action-btn-redact-active"
                    : "action-btn-quiet",
                )}
                onClick={() => {
                  setPreviewMode("watermarked");
                  setRedactEnabled(!redactEnabled);
                }}
              >
                Hide sensitive details
                {redactions.length > 0 && (
                  <span className="rounded-full bg-slate-900/10 px-1.5 py-0.5 text-[11px]">
                    {redactions.length}
                  </span>
                )}
              </button>
            </div>
          </section>

          <aside className="content-card p-5 lg:sticky lg:top-5">
            <div>
              <p className="section-label">
                {redactEnabled ? "Redaction" : "Watermark"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {redactEnabled ? "Hide sensitive details" : "Make it yours"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {redactEnabled
                  ? "Drag over any information you do not want to share."
                  : "The recommended settings already provide balanced protection."}
              </p>
            </div>

            {redactEnabled ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  How to redact
                </p>
                <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-relaxed text-amber-900">
                  <li>Drag over a detail to cover it</li>
                  <li>Select a box to move, resize, rotate, or delete it</li>
                  <li>Choose Done when you are finished</li>
                </ol>

                <p className="mt-4 text-xs font-medium text-amber-800">
                  {redactions.length === 0
                    ? "No details hidden yet"
                    : `${redactions.length} ${redactions.length === 1 ? "detail" : "details"} hidden`}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="action-btn action-btn-quiet"
                    disabled={redactions.length === 0}
                    onClick={() => {
                      setRedactions((current) => current.slice(0, -1));
                      setSelectedIndex(null);
                    }}
                  >
                    Undo last
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn-quiet"
                    disabled={redactions.length === 0}
                    onClick={() => {
                      setRedactions([]);
                      setSelectedIndex(null);
                    }}
                  >
                    Clear all
                  </button>
                </div>

                <button
                  type="button"
                  className="action-btn action-btn-primary mt-3 w-full"
                  onClick={() => setRedactEnabled(false)}
                >
                  Done redacting
                </button>
              </div>
            ) : (
              <>
                <label className="mt-6 block">
                  <span className="field-label">Watermark text</span>
                  <input
                    type="text"
                    name="watermark-text"
                    value={settings.text}
                    onChange={(event) =>
                      updateSetting("text", event.target.value)
                    }
                    placeholder="Only for verification at Company"
                    className="text-input mt-2"
                  />
                  <span className="mt-1.5 block text-xs text-slate-500">
                    Tip: include the company or purpose.
                  </span>
                </label>

                <fieldset className="mt-6">
                  <legend className="field-label">Watermark size</legend>
                  <div className="choice-grid mt-2">
                    {(
                      [
                        ["Small", 26],
                        ["Medium", 34],
                        ["Large", 46],
                      ] as const
                    ).map(([label, value]) => (
                      <button
                        key={label}
                        type="button"
                        className={cx(
                          settings.fontSize === value && "is-active",
                        )}
                        onClick={() => updateSetting("fontSize", value)}
                        aria-pressed={settings.fontSize === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-6">
                  <legend className="field-label">Visibility</legend>
                  <div className="choice-grid mt-2">
                    {(
                      [
                        ["Light", 0.22],
                        ["Standard", 0.4],
                        ["Strong", 0.55],
                      ] as const
                    ).map(([label, value]) => (
                      <button
                        key={label}
                        type="button"
                        className={cx(
                          settings.opacity === value && "is-active",
                        )}
                        onClick={() => updateSetting("opacity", value)}
                        aria-pressed={settings.opacity === value}
                      >
                        {label}
                        {label === "Standard" && <small>Recommended</small>}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  className="mt-6 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => setAdvancedOpen(true)}
                >
                  Advanced settings
                  <span aria-hidden="true">›</span>
                </button>
              </>
            )}

            {notice?.tone === "error" && (
              <p className="notice-error mt-4">{notice.message}</p>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="button"
                className="action-btn action-btn-primary w-full py-3"
                onClick={handleDownload}
              >
                <DownloadIcon className="h-4 w-4" />
                Download protected image
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                PNG · Processed privately on your device
              </p>
            </div>
          </aside>
        </section>
      )}

      {advancedOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Advanced watermark settings"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setAdvancedOpen(false)}
            aria-label="Close advanced settings"
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <p className="section-label">Fine-tune</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Advanced settings
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Changes appear in the preview immediately.
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setAdvancedOpen(false)}
                aria-label="Close advanced settings"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              <ControlSection
                icon={<TypeIcon className="h-5 w-5" />}
                title="Appearance"
                subtitle="Control contrast, direction, and document color."
              >
                <RangeControl
                  name="wm-opacity"
                  label="Visibility"
                  hint="Keep document details readable"
                  valueLabel={`${(settings.opacity * 100).toFixed(0)}%`}
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  value={settings.opacity}
                  onChange={(value) => updateSetting("opacity", value)}
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
                  onChange={(value) => updateSetting("angle", value)}
                />
                <RangeControl
                  name="wm-font-size"
                  label="Text size"
                  valueLabel={`${settings.fontSize}px`}
                  min={18}
                  max={64}
                  step={1}
                  value={settings.fontSize}
                  onChange={(value) => updateSetting("fontSize", value)}
                />
                <RangeControl
                  name="wm-line-gap"
                  label="Wrapped-line spacing"
                  valueLabel={`${settings.lineGap}px`}
                  min={6}
                  max={40}
                  step={1}
                  value={settings.lineGap}
                  disabled={lines.length <= 1}
                  onChange={(value) => updateSetting("lineGap", value)}
                  footer={
                    lines.length <= 1
                      ? "Only applies when the text wraps"
                      : undefined
                  }
                />
                <label className="control-card flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Watermark color
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {settings.color.toUpperCase()}
                    </p>
                  </div>
                  <input
                    name="wm-color"
                    type="color"
                    value={settings.color}
                    onChange={(event) =>
                      updateSetting("color", event.target.value)
                    }
                    className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-1"
                  />
                </label>
                <label className="control-card flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Black-and-white document
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Can improve watermark contrast.
                    </p>
                  </div>
                  <input
                    name="wm-grayscale"
                    type="checkbox"
                    checked={settings.grayscale}
                    onChange={(event) =>
                      updateSetting("grayscale", event.target.checked)
                    }
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>
              </ControlSection>

              <ControlSection
                icon={<PatternIcon className="h-5 w-5" />}
                title="Pattern"
                subtitle="Control how often the watermark repeats."
              >
                <RangeControl
                  name="wm-spacing-x"
                  label="Horizontal gap"
                  valueLabel={`${settings.spacingX}px`}
                  min={150}
                  max={800}
                  step={5}
                  value={settings.spacingX}
                  onChange={(value) => updateSetting("spacingX", value)}
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
                  onChange={(value) => updateSetting("spacingY", value)}
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
                  onChange={(value) => updateSetting("stagger", value)}
                />
              </ControlSection>

              <ControlSection
                icon={<TypographyIcon className="h-5 w-5" />}
                title="Position"
                subtitle="Move the full watermark pattern."
              >
                <RangeControl
                  name="wm-offset-x"
                  label="Horizontal position"
                  valueLabel={`${settings.offsetX}px`}
                  min={-200}
                  max={200}
                  step={5}
                  value={settings.offsetX}
                  onChange={(value) => updateSetting("offsetX", value)}
                />
                <RangeControl
                  name="wm-offset-y"
                  label="Vertical position"
                  valueLabel={`${settings.offsetY}px`}
                  min={-200}
                  max={200}
                  step={5}
                  value={settings.offsetY}
                  onChange={(value) => updateSetting("offsetY", value)}
                />
              </ControlSection>
            </div>

            <div className="relative z-10 flex shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:px-7">
              <button
                type="button"
                className="action-btn action-btn-quiet"
                onClick={resetSettings}
              >
                <RotateIcon className="h-4 w-4" /> Restore recommended
              </button>
              <button
                type="button"
                className="action-btn action-btn-primary ml-auto"
                onClick={() => setAdvancedOpen(false)}
              >
                Done
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

type ControlSectionProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

function ControlSection({
  icon,
  title,
  subtitle,
  children,
}: ControlSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700">
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
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
  onChange,
}: RangeControlProps) {
  return (
    <label className={cx("control-card block", disabled && "opacity-45")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <span className="text-xs font-medium text-blue-700">{valueLabel}</span>
      </div>

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}

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

      {footer && <p className="mt-1 text-xs text-slate-500">{footer}</p>}
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="trust-pill trust-pill-link"
      >
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
