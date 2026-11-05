import { rings } from "../guilloche";
import type { RedactionRect } from "../imageLogic";

export const SAMPLE_WIDTH = 1712;
export const SAMPLE_HEIGHT = 1080;

const sansFamily =
  '"Geist Variable", "Avenir Next", "Segoe UI", system-ui, sans-serif';
const monoFamily = '"Geist Mono Variable", ui-monospace, Menlo, monospace';

// Layout unit: 1% of the card width, matching the specimen in the design.
const u = SAMPLE_WIDTH / 100;

type Field = { label: string; value: string; sensitive?: boolean };

const fieldRows: ReadonlyArray<readonly Field[]> = [
  [
    { label: "SURNAME", value: "SAMPLE" },
    { label: "GIVEN NAMES", value: "ALEX JORDAN" },
  ],
  [
    { label: "DATE OF BIRTH", value: "01 JAN 1990" },
    { label: "NATIONALITY", value: "UTOPIAN" },
  ],
  [
    { label: "DOCUMENT NO.", value: "X12 345 678", sensitive: true },
    { label: "EXPIRY", value: "01 JAN 2034" },
  ],
  [
    {
      label: "ADDRESS",
      value: "12 EXAMPLE STREET, SAMPLE CITY",
      sensitive: true,
    },
  ],
];

const mrzLines = [
  "IDUTOX12345678<<<<<<<<<<<<<<<<",
  "SAMPLE<<ALEX<JORDAN<<<<<<<<<<<",
] as const;

function setText(
  context: CanvasRenderingContext2D,
  font: string,
  color: string,
  letterSpacingEm = 0,
  fontSize = 0,
) {
  context.font = font;
  context.fillStyle = color;
  // Older engines without canvas letterSpacing simply draw tighter text.
  if ("letterSpacing" in context) {
    context.letterSpacing = `${letterSpacingEm * fontSize}px`;
  }
}

function coverRect(
  x: number,
  y: number,
  width: number,
  height: number,
  padX: number,
  padY: number,
): RedactionRect {
  return {
    x: x - padX,
    y: y - padY,
    w: width + padX * 2,
    h: height + padY * 2,
    angle: 0,
  };
}

/**
 * Draws a fictional ID card so people can try the editor without their own
 * document. Returns boxes covering the fields someone would usually hide.
 */
export function drawSampleDocument(
  context: CanvasRenderingContext2D,
): RedactionRect[] {
  const sensitive: RedactionRect[] = [];
  const padLeft = 5 * u;
  const padTop = 4.4 * u;
  const padBottom = 4 * u;

  context.save();
  context.textBaseline = "top";
  context.fillStyle = "#E3E9E2";
  context.fillRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

  const titleSize = 2.6 * u;
  setText(
    context,
    `700 ${titleSize}px ${sansFamily}`,
    "#10241D",
    0.12,
    titleSize,
  );
  context.fillText("IDENTITY CARD", padLeft, padTop);

  const subtitleSize = 1.5 * u;
  setText(
    context,
    `500 ${subtitleSize}px ${sansFamily}`,
    "#52615A",
    0.08,
    subtitleSize,
  );
  context.fillText(
    "SPECIMEN · NOT A REAL DOCUMENT",
    padLeft,
    padTop + titleSize * 1.3 + 0.6 * u,
  );

  const sealSize = 6.5 * u;
  const sealX = SAMPLE_WIDTH - padLeft - sealSize / 2;
  const sealY = padTop + sealSize / 2;
  // A guilloche rosette, drawn a little larger than the space it reserves.
  const sealDrawSize = 8 * u;
  context.save();
  context.translate(sealX - sealDrawSize / 2, sealY - sealDrawSize / 2);
  context.scale(sealDrawSize / 100, sealDrawSize / 100);
  context.globalAlpha = 0.5;
  context.strokeStyle = "#1D6B50";
  context.lineWidth = 1.3;
  context.stroke(new Path2D(rings(50, 50, 7, 20, 3.6, 14, 3.5, 0.45)));
  context.restore();

  const bodyTop = padTop + sealSize + 2.6 * u;
  const photoWidth = 22 * u;
  const photoHeight = (photoWidth * 4) / 3;
  context.fillStyle = "#C9D3CB";
  context.beginPath();
  context.roundRect(padLeft, bodyTop, photoWidth, photoHeight, 1.4 * u);
  context.fill();

  // Silhouette from a 60 × 80 viewBox, 84% of the photo width, bottom-aligned.
  const iconScale = (photoWidth * 0.84) / 60;
  const iconLeft = padLeft + (photoWidth - 60 * iconScale) / 2;
  const iconTop = bodyTop + photoHeight - 80 * iconScale;
  context.save();
  context.beginPath();
  context.roundRect(padLeft, bodyTop, photoWidth, photoHeight, 1.4 * u);
  context.clip();
  context.fillStyle = "#A5B3A9";
  context.beginPath();
  context.arc(
    iconLeft + 30 * iconScale,
    iconTop + 31 * iconScale,
    13 * iconScale,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.beginPath();
  context.moveTo(iconLeft + 5 * iconScale, iconTop + 80 * iconScale);
  context.bezierCurveTo(
    iconLeft + 5 * iconScale,
    iconTop + 65 * iconScale,
    iconLeft + 16 * iconScale,
    iconTop + 53 * iconScale,
    iconLeft + 30 * iconScale,
    iconTop + 53 * iconScale,
  );
  context.bezierCurveTo(
    iconLeft + 44 * iconScale,
    iconTop + 53 * iconScale,
    iconLeft + 55 * iconScale,
    iconTop + 65 * iconScale,
    iconLeft + 55 * iconScale,
    iconTop + 80 * iconScale,
  );
  context.closePath();
  context.fill();
  context.restore();

  const fieldsLeft = padLeft + photoWidth + 4 * u;
  const columnWidth = (SAMPLE_WIDTH - padLeft - fieldsLeft - 3 * u) / 2;
  const labelSize = 1.45 * u;
  const valueSize = 2.4 * u;
  const rowHeight = labelSize * 1.4 + 0.5 * u + valueSize * 1.3 + 2.1 * u;

  fieldRows.forEach((row, rowIndex) => {
    row.forEach((field, columnIndex) => {
      const x = fieldsLeft + columnIndex * (columnWidth + 3 * u);
      const y = bodyTop + rowIndex * rowHeight;
      setText(
        context,
        `500 ${labelSize}px ${sansFamily}`,
        "#52615A",
        0.06,
        labelSize,
      );
      context.fillText(field.label, x, y);

      const valueY = y + labelSize * 1.4 + 0.5 * u;
      setText(context, `600 ${valueSize}px ${sansFamily}`, "#10241D");
      context.fillText(field.value, x, valueY);

      if (field.sensitive) {
        const width = context.measureText(field.value).width;
        sensitive.push(coverRect(x, valueY, width, valueSize, 1 * u, 0.5 * u));
      }
    });
  });

  const mrzSize = 2.4 * u;
  const mrzLineHeight = mrzSize * 1.45;
  const mrzTop = SAMPLE_HEIGHT - padBottom - mrzLineHeight * mrzLines.length;
  setText(context, `400 ${mrzSize}px ${monoFamily}`, "#1E3129", 0.14, mrzSize);
  let mrzWidth = 0;
  mrzLines.forEach((line, index) => {
    context.fillText(line, padLeft, mrzTop + index * mrzLineHeight);
    mrzWidth = Math.max(mrzWidth, context.measureText(line).width);
  });
  sensitive.push(
    coverRect(
      padLeft,
      mrzTop,
      mrzWidth,
      mrzLineHeight * mrzLines.length,
      1 * u,
      0.6 * u,
    ),
  );

  context.restore();
  return sensitive;
}

/** Canvas text falls back to system fonts unless the web fonts are loaded. */
export async function loadSampleFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`600 40px ${sansFamily}`),
      document.fonts.load(`400 40px ${monoFamily}`),
    ]);
  } catch {
    // Drawing with fallback fonts is fine.
  }
}

/** Renders the sample card into a PNG file the editor can open. */
export async function createSampleDocumentFile(): Promise<File> {
  await loadSampleFonts();
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  drawSampleDocument(context);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not create the sample document.");
  return new File([blob], "sample-id.png", { type: "image/png" });
}
