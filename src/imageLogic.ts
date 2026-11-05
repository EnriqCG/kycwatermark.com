export type WatermarkSettings = {
  pattern: "woven" | "text";
  textureDensity: number;
  wovenFontSize: number;
  waveFrequency: number;
  letterWarp: number;
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

export type RedactionRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
};

export type EdgeZone = "top" | "bottom" | "left" | "right";

export type Point = { x: number; y: number };

export type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const REFERENCE_DIAGONAL = 1000;

export function getScaleFactor(width: number, height: number): number {
  return Math.sqrt(width ** 2 + height ** 2) / REFERENCE_DIAGONAL;
}

export function scaleWatermarkSettings(
  settings: WatermarkSettings,
  scaleFactor: number,
) {
  return {
    fontSize: settings.fontSize * scaleFactor,
    wovenFontSize: settings.wovenFontSize * scaleFactor,
    spacingX: settings.spacingX * scaleFactor,
    spacingY: settings.spacingY * scaleFactor,
    lineGap: settings.lineGap * scaleFactor,
    offsetX: settings.offsetX * scaleFactor,
    offsetY: settings.offsetY * scaleFactor,
    stagger: settings.stagger * scaleFactor,
  };
}

export function wrapWatermarkText(
  text: string,
  maxLineWidth: number,
  measureText: (text: string) => number,
): { lines: string[]; textWidth: number } {
  const trimmedText = text.trim();
  if (!trimmedText) return { lines: [], textWidth: 0 };

  const lines: string[] = [];
  let currentLine = "";

  for (const word of trimmedText.split(/\s+/)) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (measureText(testLine) > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return {
    lines,
    textWidth: lines.reduce(
      (maximum, line) => Math.max(maximum, measureText(line)),
      0,
    ),
  };
}

export function getEffectiveWatermarkSpacing(
  lines: string[],
  textWidth: number,
  fontSize: number,
  spacingX: number,
  spacingY: number,
  lineGap: number,
) {
  const verticalSpan =
    lines.length === 0 ? fontSize : (fontSize + lineGap) * lines.length;
  const padding = fontSize * 0.6;

  return {
    verticalSpan,
    spacingX: Math.max(spacingX, textWidth + padding),
    spacingY: Math.max(spacingY, verticalSpan + padding),
  };
}

export type StrengthValues = Pick<
  WatermarkSettings,
  | "opacity"
  | "fontSize"
  | "spacingX"
  | "spacingY"
  | "textureDensity"
  | "wovenFontSize"
  | "waveFrequency"
  | "letterWarp"
>;

export const strengthPresets = [
  {
    id: "subtle",
    label: "Subtle",
    values: {
      opacity: 0.24,
      fontSize: 28,
      spacingX: 520,
      spacingY: 210,
      textureDensity: 0.3,
      wovenFontSize: 12,
      waveFrequency: 1.75,
      letterWarp: 0.2,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    values: {
      opacity: 0.36,
      fontSize: 30,
      spacingX: 460,
      spacingY: 175,
      textureDensity: 0.5,
      wovenFontSize: 11,
      waveFrequency: 2.5,
      letterWarp: 0.4,
    },
  },
  {
    id: "bold",
    label: "Bold",
    values: {
      opacity: 0.48,
      fontSize: 30,
      spacingX: 420,
      spacingY: 150,
      textureDensity: 0.75,
      wovenFontSize: 10,
      waveFrequency: 3,
      letterWarp: 0.65,
    },
  },
  {
    id: "dense",
    label: "Dense",
    values: {
      opacity: 0.44,
      fontSize: 26,
      spacingX: 340,
      spacingY: 115,
      textureDensity: 1,
      wovenFontSize: 9,
      waveFrequency: 3.5,
      letterWarp: 0.85,
    },
  },
] as const;

export const recommendedStrength = strengthPresets[2];

export function composeWatermarkText(
  purpose: string,
  recipient: string,
): string {
  return `Only for ${purpose} at ${recipient.trim() || "[Company]"}`;
}

/** The date is its own option, added after either suggested or custom text. */
export function addWatermarkDate(text: string, date?: string): string {
  return [text.trim(), date ?? ""].filter(Boolean).join(" · ");
}

export function formatWatermarkDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function findMatchingPreset<T extends { values: StrengthValues }>(
  settings: WatermarkSettings,
  presets: readonly T[],
): T | null {
  return (
    presets.find(({ values }) =>
      (Object.keys(values) as Array<keyof StrengthValues>).every((key) => {
        const wovenKey = [
          "textureDensity",
          "wovenFontSize",
          "waveFrequency",
          "letterWarp",
        ].includes(key);
        const straightKey = ["fontSize", "spacingX", "spacingY"].includes(key);
        if (
          (settings.pattern === "text" && wovenKey) ||
          (settings.pattern === "woven" && straightKey)
        )
          return true;
        return settings[key] === values[key];
      }),
    ) ?? null
  );
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getDownloadFileName(
  fileName: string,
  defaultName: string,
  recipient = "",
): string {
  if (!fileName) return defaultName;
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const recipientSlug = slugify(recipient);
  const suffix = recipientSlug ? `for-${recipientSlug}` : "kyc-watermarked";
  return `${baseName}-${suffix}.png`;
}

export function getImageFileValidationError(file: {
  type: string;
  size: number;
}): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please drop a valid image file (PNG, JPG, WebP, HEIC).";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Image is too large. Keep files under 20MB.";
  }
  return null;
}

export function screenToCanvas(
  point: Point,
  canvas: { width: number; height: number },
  bounds: Bounds,
): Point {
  const canvasAspect = canvas.width / canvas.height;
  const cssAspect = bounds.width / bounds.height;

  let renderWidth: number;
  let renderHeight: number;
  let offsetX: number;
  let offsetY: number;
  if (canvasAspect > cssAspect) {
    renderWidth = bounds.width;
    renderHeight = bounds.width / canvasAspect;
    offsetX = 0;
    offsetY = (bounds.height - renderHeight) / 2;
  } else {
    renderHeight = bounds.height;
    renderWidth = bounds.height * canvasAspect;
    offsetX = (bounds.width - renderWidth) / 2;
    offsetY = 0;
  }

  return {
    x: ((point.x - bounds.left - offsetX) / renderWidth) * canvas.width,
    y: ((point.y - bounds.top - offsetY) / renderHeight) * canvas.height,
  };
}

export function toLocal(px: number, py: number, rect: RedactionRect) {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const cos = Math.cos(-rect.angle);
  const sin = Math.sin(-rect.angle);
  const dx = px - centerX;
  const dy = py - centerY;
  return { lx: dx * cos - dy * sin, ly: dx * sin + dy * cos };
}

export function pointInRect(
  px: number,
  py: number,
  rect: RedactionRect,
): boolean {
  const { lx, ly } = toLocal(px, py, rect);
  return Math.abs(lx) <= rect.w / 2 && Math.abs(ly) <= rect.h / 2;
}

export function pointOnRotationHandle(
  px: number,
  py: number,
  rect: RedactionRect,
  scaleFactor: number,
): boolean {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const distance = rect.h / 2 + 20 * scaleFactor;
  const handleX = centerX + distance * Math.sin(rect.angle);
  const handleY = centerY - distance * Math.cos(rect.angle);
  const hitRadius = 12 * scaleFactor;
  return (px - handleX) ** 2 + (py - handleY) ** 2 <= hitRadius ** 2;
}

export function pointOnDeleteHandle(
  px: number,
  py: number,
  rect: RedactionRect,
  scaleFactor: number,
): boolean {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const distance = rect.h / 2 + 20 * scaleFactor;
  const handleX = centerX - distance * Math.sin(rect.angle);
  const handleY = centerY + distance * Math.cos(rect.angle);
  const hitRadius = 12 * scaleFactor;
  return (px - handleX) ** 2 + (py - handleY) ** 2 <= hitRadius ** 2;
}

export function findEdgeZone(
  px: number,
  py: number,
  rect: RedactionRect,
  scaleFactor: number,
): EdgeZone | null {
  const { lx, ly } = toLocal(px, py, rect);
  const threshold = 8 * scaleFactor;
  const halfWidth = rect.w / 2;
  const halfHeight = rect.h / 2;
  if (
    Math.abs(lx) > halfWidth + threshold ||
    Math.abs(ly) > halfHeight + threshold
  ) {
    return null;
  }

  const distances: Array<[EdgeZone, number]> = [
    ["top", Math.abs(ly + halfHeight)],
    ["bottom", Math.abs(ly - halfHeight)],
    ["left", Math.abs(lx + halfWidth)],
    ["right", Math.abs(lx - halfWidth)],
  ];
  const [edge, distance] = distances.reduce((closest, candidate) =>
    candidate[1] < closest[1] ? candidate : closest,
  );
  return distance <= threshold ? edge : null;
}

export function edgeCursor(edge: EdgeZone, angle: number): string {
  const resizeAngle =
    edge === "top" || edge === "bottom" ? Math.PI / 2 + angle : angle;
  const normalized = ((resizeAngle % Math.PI) + Math.PI) % Math.PI;
  const sector = Math.round(normalized / (Math.PI / 4)) % 4;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][sector];
}

export function resizeRect(
  snapshot: RedactionRect,
  position: Point,
  edge: EdgeZone,
): RedactionRect {
  const snapshotCenterX = snapshot.x + snapshot.w / 2;
  const snapshotCenterY = snapshot.y + snapshot.h / 2;
  const { lx, ly } = toLocal(position.x, position.y, snapshot);
  const minimumSize = 6;

  let newWidth = snapshot.w;
  let newHeight = snapshot.h;
  let shiftX = 0;
  let shiftY = 0;

  if (edge === "right") {
    const moved = Math.max(lx, -snapshot.w / 2 + minimumSize);
    newWidth = moved + snapshot.w / 2;
    shiftX = (moved - snapshot.w / 2) / 2;
  } else if (edge === "left") {
    const moved = Math.min(lx, snapshot.w / 2 - minimumSize);
    newWidth = snapshot.w / 2 - moved;
    shiftX = (moved + snapshot.w / 2) / 2;
  } else if (edge === "bottom") {
    const moved = Math.max(ly, -snapshot.h / 2 + minimumSize);
    newHeight = moved + snapshot.h / 2;
    shiftY = (moved - snapshot.h / 2) / 2;
  } else {
    const moved = Math.min(ly, snapshot.h / 2 - minimumSize);
    newHeight = snapshot.h / 2 - moved;
    shiftY = (moved + snapshot.h / 2) / 2;
  }

  const cos = Math.cos(snapshot.angle);
  const sin = Math.sin(snapshot.angle);
  const newCenterX = snapshotCenterX + shiftX * cos - shiftY * sin;
  const newCenterY = snapshotCenterY + shiftX * sin + shiftY * cos;

  return {
    x: newCenterX - newWidth / 2,
    y: newCenterY - newHeight / 2,
    w: newWidth,
    h: newHeight,
    angle: snapshot.angle,
  };
}
