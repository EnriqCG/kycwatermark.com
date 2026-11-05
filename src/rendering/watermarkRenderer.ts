import type { RedactionRect, WatermarkSettings } from "../imageLogic";
import {
  advanceWovenText,
  createWovenWave,
  glyphRipple,
} from "./wovenGeometry.js";
import { browserTextDirection, segmentWovenText } from "./wovenText.js";

export type WatermarkRenderOptions = {
  width: number;
  height: number;
  watermarked: boolean;
  grayscale: boolean;
  redactions: readonly RedactionRect[];
  lines: readonly string[];
  /** Raw purpose text, independent of Straight text wrapping. */
  text?: string;
  fontRevision?: number;
  opacity: number;
  color: string;
  font: string;
  angleDegrees: number;
  offsetX: number;
  offsetY: number;
  spacingX: number;
  spacingY: number;
  fontSize: number;
  lineGap: number;
  stagger: number;
  pattern: WatermarkSettings["pattern"];
  textureDensity: number;
  wovenFontSize: number;
  waveFrequency: number;
  letterWarp: number;
  patternSeed: number;
};

// Stateless mixing keeps a document's geometry stable through setting changes.
// This is pattern variation, not a secret key or a cryptographic defense.
function randomAt(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}

function drawWovenText(
  context: CanvasRenderingContext2D,
  options: WatermarkRenderOptions,
  diagonal: number,
  createCanvas: CanvasFactory,
) {
  const unit = diagonal / 1000;
  const density = Math.max(0, Math.min(1, options.textureDensity));
  if (density === 0) return;
  const size = options.wovenFontSize / unit;
  const waveFrequency = Math.max(1, Math.min(5, options.waveFrequency));
  const letterWarp = Math.max(0, Math.min(1, options.letterWarp));
  const rowGap = size * (2.8 - 1.45 * density) * (1 + 0.12 * letterWarp);
  // Position sliders are bounded to ±200 reference units on each axis.
  // A fixed walk origin preserves every seeded glyph when the pattern translates.
  const extent = 950;
  const seeded = (slot: number) => randomAt(options.patternSeed, 100000 + slot);
  const phase = seeded(1) * Math.PI * 2;
  const frequency = waveFrequency / (55 + seeded(2) * 35);
  // Shorter waves need less height to keep their slopes and dense rows legible.
  // Large letters cannot fit tightly curved short waves without their ink
  // colliding on the inner bend. Reduce both short-wave heights smoothly when
  // the em grows relative to wavelength; frequency itself retains its meaning.
  const curvatureScale = 1 / Math.max(1, size * frequency * 1.5);
  const amplitude =
    ((16 + seeded(3) * 8) / Math.sqrt(waveFrequency)) * curvatureScale;
  const secondaryPhase = seeded(4) * Math.PI * 2;
  const ripplePhase = seeded(5) * Math.PI * 2;
  const rippleAmplitude = (waveFrequency - 1) * 0.4 * curvatureScale;
  const angle = (Math.PI / 180) * options.angleDegrees;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);

  const text = segmentWovenText(options.text ?? options.lines.join(" "));
  const sprites = new WovenSprites(context, options, text, createCanvas);
  try {
    const layouts = sprites.layouts(unit, size);
    for (
      let row = -Math.ceil(extent / rowGap);
      row <= Math.ceil(extent / rowGap);
      row++
    ) {
      const rand = (slot: number) =>
        randomAt(options.patternSeed, row * 13 + slot);
      const rowPhase = phase + row * 0.065 + (rand(1) - 0.5) * 0.025;
      const rowAmplitude = amplitude + (rand(2) - 0.5) * 0.8 * curvatureScale;
      const base = row * rowGap + (rand(3) - 0.5) * rowGap * 0.06;
      const field = createWovenWave({
        base,
        amplitude: rowAmplitude,
        frequency,
        phase: rowPhase,
        secondaryPhase: secondaryPhase + row * 0.04,
        ripplePhase,
        rippleAmplitude,
        variation: letterWarp,
        row,
      });
      const slope = (x: number) => field.sample(x).slope;
      const letterPhase = secondaryPhase + row * 0.27 + rand(4) * 0.35;
      const widthAt = (x: number) =>
        1 + letterWarp * 0.18 * Math.sin(x * frequency * 1.7 + letterPhase);
      const layout = layouts[row % 6 === 0 ? 1 : 0];
      const rowAlpha = options.opacity * (0.82 + rand(8) * 0.18);
      context.globalAlpha = rowAlpha;
      // A single bounded row scratch removes rotated drawImage-edge cracks in
      // connected scripts. Shared-edge antialias coverage is added in this row;
      // rotate and apply opacity only to the finished row, never each join.
      const halfHeight = (layout.inkHeight / unit + size * 0.12) / 2;
      const waveHeight =
        rowAmplitude * (1 + 0.28 * letterWarp) + 5 + rippleAmplitude;
      const rowTop = base - waveHeight - halfHeight * 1.35;
      const rowHeight = 2 * (waveHeight + halfHeight * 1.35) * unit;
      const rowWidth = 2 * extent * unit;
      if (text.shaped) {
        // Do not clear/rasterize scratch rows whose entire bounds miss the
        // rotated viewport. This is culling only: walk origins and sampling
        // coordinates remain fixed when Position changes.
        const viewportHalfY =
          (Math.abs(sin) * options.width + Math.abs(cos) * options.height) /
          (2 * unit);
        const projectedOffsetY =
          (-options.offsetX * sin + options.offsetY * cos) / unit;
        if (
          Math.abs(base + projectedOffsetY) >
          viewportHalfY + waveHeight + halfHeight * 1.35
        )
          continue;
      }
      const rowTarget = text.shaped
        ? sprites.rowTarget(rowWidth, rowHeight)
        : null;
      const target = rowTarget?.context ?? context;
      if (rowTarget) {
        target.save();
        // Add premultiplied coverage within ONE connected row: shared edge
        // antialias samples sum, instead of source-over attenuating the join.
        target.globalCompositeOperation = "lighter";
        target.transform(
          rowTarget.resolution,
          0,
          0,
          rowTarget.resolution,
          extent * unit * rowTarget.resolution,
          -rowTop * unit * rowTarget.resolution,
        );
      }
      let x = -extent - rand(9) * Math.min(layout.repeatWidth, extent);
      let tokenIndex = Math.floor(rand(10) * layout.runs.length);
      while (x < extent) {
        const run = layout.runs[tokenIndex % layout.runs.length];
        const advance = advanceWovenText(
          x,
          run.width,
          frequency,
          slope,
          widthAt,
        );
        const center = x + advance / 2;
        const { y, slope: tangent } = field.sample(center);
        const widthScale = widthAt(center);
        // Smooth changes deform the glyphs themselves, not just their baseline.
        const heightWave = Math.sin(
          center * frequency * 2.1 + letterPhase + 1.2,
        );
        const normalGap =
          rowGap / Math.hypot(1, text.shaped ? field.slopeBound : tangent);
        const heightLimit = Math.max(
          0.7,
          (normalGap * 0.9) / (size * layout.scale),
        );
        const heightScale =
          1 +
          letterWarp *
            (Math.min(
              1 + 0.32 * (text.shaped ? Math.sin(letterPhase) : heightWave),
              heightLimit,
            ) -
              1);
        const shear =
          letterWarp * 0.2 * Math.sin(center * frequency * 1.3 + letterPhase);
        const imageX =
          options.width / 2 + options.offsetX + unit * (center * cos - y * sin);
        const imageY =
          options.height / 2 +
          options.offsetY +
          unit * (center * sin + y * cos);
        const margin = (run.width * 1.18 + size * 1.8) * unit;
        if (
          run.ink &&
          imageX > -margin &&
          imageX < options.width + margin &&
          imageY > -margin &&
          imageY < options.height + margin
        ) {
          target.save();
          try {
            if (text.shaped) {
              // Adjacent visual strips share exactly the same vertical boundary:
              // secant endpoints, constant height, no independently rotated edges.
              // First/last crops alone include paragraph ink overshoots.
              const left = field.sample(x).y,
                right = field.sample(x + advance).y;
              target.translate(center * unit, ((left + right) / 2) * unit);
              target.transform(
                advance / run.width,
                (right - left) / run.width,
                0,
                heightScale,
                0,
                0,
              );
            } else {
              target.translate(center * unit, y * unit);
              target.rotate(Math.atan(tangent));
              target.transform(widthScale, 0, shear, heightScale, 0, 0);
            }
            sprites.draw(target, run);
          } finally {
            target.restore();
          }
        }
        x += advance;
        tokenIndex++;
      }
      if (rowTarget) {
        target.restore();
        context.drawImage(
          rowTarget.canvas,
          -extent * unit,
          rowTop * unit,
          rowTarget.canvas.width / rowTarget.resolution,
          rowTarget.canvas.height / rowTarget.resolution,
        );
      }
    }
  } finally {
    sprites.dispose();
  }
}

/**
 * Draws the exported image layers. The caller owns sizing the canvas and may
 * draw editor-only overlays afterwards. Keeping this function free of React
 * makes the output contract directly testable.
 */
export function renderWatermarkedImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  options: WatermarkRenderOptions,
  cache?: WatermarkLayerCache,
): void {
  const { width, height } = options;

  context.save();
  context.clearRect(0, 0, width, height);
  context.filter =
    options.watermarked && options.grayscale ? "grayscale(100%)" : "none";
  context.drawImage(source, 0, 0, width, height);
  context.restore();

  if (!options.watermarked) return;

  for (const rect of options.redactions) {
    context.save();
    context.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    context.rotate(rect.angle);
    context.fillStyle = "#000000";
    context.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    context.restore();
  }

  const layer = cache?.get(source, options);
  if (layer) context.drawImage(layer, 0, 0);
  else drawWatermark(context, options, cache?.createCanvas ?? browserCanvas);
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  options: WatermarkRenderOptions,
  createCanvas: CanvasFactory,
) {
  const { width, height } = options;
  if (!(options.text ?? options.lines.join(" ")).trim() || options.opacity <= 0)
    return;

  context.save();
  try {
    context.globalAlpha = options.opacity;
    context.fillStyle = options.color;
    context.font = options.font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.translate(
      width / 2 + options.offsetX,
      height / 2 + options.offsetY,
    );
    context.rotate((Math.PI / 180) * options.angleDegrees);

    const diagonal = Math.sqrt(width * width + height * height);
    if (options.pattern === "woven") {
      drawWovenText(context, options, diagonal, createCanvas);
      return;
    }
    const lineHeight = options.fontSize + options.lineGap;
    const rows: number[] = [];
    for (let y = -diagonal; y <= diagonal; y += options.spacingY) rows.push(y);
    const centerRowIndex = Math.floor(rows.length / 2);

    rows.forEach((y, rowIndex) => {
      const rowOffset = (rowIndex - centerRowIndex) * options.stagger;
      for (
        let x = -diagonal + rowOffset - options.spacingX;
        x <= diagonal + options.spacingX;
        x += options.spacingX
      ) {
        options.lines.forEach((line, lineIndex) => {
          context.fillText(line, x, y + lineIndex * lineHeight);
        });
      }
    });
  } finally {
    context.restore();
  }
}

export type CanvasFactory = () => HTMLCanvasElement;
const browserCanvas: CanvasFactory = () => document.createElement("canvas");

/** One owner per editor. No document pixels or canvases are retained globally.
 * At most one 16 MP transparent layer (64 MB); larger images render directly.
 * Sprites are temporary and separately bounded, including on the direct path. */
export class WatermarkLayerCache {
  private layer: HTMLCanvasElement | null = null;
  private source: CanvasImageSource | null = null;
  private key = "";
  constructor(readonly createCanvas: CanvasFactory = browserCanvas) {}

  clear() {
    if (this.layer) this.layer.width = this.layer.height = 0;
    this.layer = null;
    this.source = null;
    this.key = "";
  }

  get(source: CanvasImageSource, options: WatermarkRenderOptions) {
    // Only image compositing state is excluded. All rendering settings, including
    // raw text, wrapping, dimensions, offsets and seed, participate in this key.
    const {
      redactions: _rects,
      grayscale: _gray,
      watermarked: _mode,
      ...pattern
    } = options;
    const key = JSON.stringify(pattern);
    if (this.layer && this.source === source && this.key === key)
      return this.layer;
    this.clear();
    if (options.width * options.height > 16_000_000) return null;
    const layer = this.createCanvas();
    layer.width = options.width;
    layer.height = options.height;
    const context = layer.getContext("2d");
    if (!context) {
      layer.width = layer.height = 0;
      return null;
    }
    try {
      drawWatermark(context, options, this.createCanvas);
      this.layer = layer;
      this.source = source;
      this.key = key;
      return layer;
    } catch (error) {
      layer.width = layer.height = 0;
      throw error;
    }
  }
}

type SpriteRun = {
  width: number;
  ink: boolean;
  atlas: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

/** Two bounded atlases total: original browser-shaped ink and its bent copy.
 * Both row sizes are packed together. The original is released before placing
 * occurrences; no per-occurrence text rasterization or full-size row buffers. */
class WovenSprites {
  private atlases: HTMLCanvasElement[] = [];
  private scratch: HTMLCanvasElement | null = null;
  constructor(
    private measure: CanvasRenderingContext2D,
    private options: WatermarkRenderOptions,
    private text: ReturnType<typeof segmentWovenText>,
    private createCanvas: CanvasFactory,
  ) {}

  layouts(unit: number, size: number) {
    const entries = [1, 1.18].flatMap((scale) => {
      const px = size * scale * unit;
      const font = this.options.font.replace(/[\d.]+px/, `${px}px`);
      this.measure.font = font;
      this.measure.textAlign = "left";
      this.measure.textBaseline = "middle";
      return [...new Set(this.text.tokens)].map((text) => {
        const metrics = this.measure.measureText(text);
        const advance = Math.max(px * 0.12, metrics.width);
        const pad = Math.max(
          px * 0.8,
          metrics.actualBoundingBoxLeft || 0,
          (metrics.actualBoundingBoxRight || 0) - advance,
        );
        const halfHeight = Math.max(
          px,
          metrics.actualBoundingBoxAscent || 0,
          metrics.actualBoundingBoxDescent || 0,
        );
        return {
          text,
          advance,
          pad,
          width: advance + 2 * pad,
          height: halfHeight * 2,
          x: 0,
          y: 0,
          px,
          font,
          scale,
        };
      });
    });
    const area = entries.reduce(
      (sum, entry) => sum + entry.width * entry.height,
      0,
    );
    const maxWidth = entries.reduce(
      (maximum, entry) => Math.max(maximum, entry.width),
      0,
    );
    let resolution = Math.min(3, Math.sqrt(1_500_000 / area), 8000 / maxWidth);
    let atlasWidth = 0,
      atlasHeight = 0;
    // Packing overhead is included in the hard limit. Very long custom text
    // trades sprite resolution for bounded memory rather than allocating rows.
    for (;;) {
      const shelfWidth = Math.min(
        8192,
        Math.max(
          256,
          Math.ceil(Math.sqrt(area) * resolution),
          Math.ceil(maxWidth * resolution),
        ),
      );
      let x = 0,
        y = 0,
        shelfHeight = 0;
      atlasWidth = 0;
      for (const entry of entries) {
        const w = Math.ceil(entry.width * resolution),
          h = Math.ceil(entry.height * resolution);
        if (x + w > shelfWidth) {
          y += shelfHeight;
          x = 0;
          shelfHeight = 0;
        }
        entry.x = x;
        entry.y = y;
        x += w;
        shelfHeight = Math.max(shelfHeight, h);
        atlasWidth = Math.max(atlasWidth, x);
      }
      atlasHeight = y + shelfHeight;
      if (atlasWidth * atlasHeight <= 2_000_000 && atlasHeight <= 8192) break;
      resolution *= 0.8;
    }
    const original = this.createCanvas();
    this.atlases.push(original);
    original.width = atlasWidth;
    original.height = atlasHeight;
    const ctx = original.getContext("2d");
    if (!ctx) throw new Error("Could not render watermark text.");
    ctx.fillStyle = this.options.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.direction = this.text.shaped
      ? browserTextDirection(this.text.text)
      : "ltr";
    for (const entry of entries) {
      ctx.font = entry.font;
      ctx.save();
      ctx.translate(entry.x, entry.y);
      ctx.transform(resolution, 0, 0, resolution, 0, 0);
      ctx.fillText(entry.text, entry.pad, entry.height / 2);
      ctx.restore();
    }
    const variation = Math.max(0, Math.min(1, this.options.letterWarp));
    let atlas = original;
    if (variation > 0) {
      atlas = this.createCanvas();
      this.atlases.push(atlas);
      atlas.width = atlasWidth;
      atlas.height = atlasHeight;
      const bent = atlas.getContext("2d");
      if (!bent) throw new Error("Could not render watermark text.");
      // Integer horizontal scanlines tile the atlas with neither overlap nor
      // cracks. Only x changes, so adjacent strips share their entire y edge.
      // Apply opacity once, when placing the finished sprite. This avoids dark
      // overlap seams at intermediate opacity without full-resolution row layers.
      for (const entry of entries) {
        const w = Math.ceil(entry.width * resolution);
        const h = Math.ceil(entry.height * resolution);
        for (let j = 0; j < h; j++) {
          const yEm = ((j + 0.5) / resolution - entry.height / 2) / entry.px;
          const dx = glyphRipple(yEm, variation) * entry.px * resolution;
          bent.drawImage(
            original,
            entry.x,
            entry.y + j,
            w,
            1,
            entry.x + dx,
            entry.y + j,
            w,
            1,
          );
        }
      }
      original.width = original.height = 0;
      this.scratch = original;
    }
    const runsByText = new Map<string, SpriteRun[]>();
    for (const entry of entries) {
      // Whole native paragraphs follow the baseline in visual strips; glyph
      // curvature is already inside their atlas pixels, preserving native joins.
      const count = this.text.shaped
        ? Math.max(1, Math.ceil(entry.advance / (entry.px * 0.35)))
        : 1;
      const advance = entry.advance / count;
      const runs: SpriteRun[] = [];
      for (let i = 0; i < count; i++) {
        const leftPad = i === 0 ? entry.pad : 0;
        const rightPad = i === count - 1 ? entry.pad : 0;
        const crop = advance + leftPad + rightPad;
        runs.push({
          width: advance / unit,
          ink: !!entry.text.trim(),
          atlas,
          sx: entry.x + (entry.pad + i * advance - leftPad) * resolution,
          sy: entry.y,
          sw: crop * resolution,
          sh: entry.height * resolution,
          dx: -advance / 2 - leftPad,
          dy: -entry.height / 2,
          dw: crop,
          dh: entry.height,
        });
      }
      runsByText.set(`${entry.scale}:${entry.text}`, runs);
    }
    return [1, 1.18].map((scale) => {
      const runs = this.text.tokens.flatMap(
        (text) => runsByText.get(`${scale}:${text}`) ?? [],
      );
      return {
        scale,
        runs,
        repeatWidth: runs.reduce((sum, run) => sum + run.width, 0),
        inkHeight: runs.reduce((maximum, run) => Math.max(maximum, run.dh), 0),
      };
    });
  }

  rowTarget(width: number, height: number) {
    if (!this.scratch) {
      this.scratch = this.createCanvas();
      this.atlases.push(this.scratch);
    }
    const canvas = this.scratch;
    // Include ceil/packing overhead in the same hard 2 MP/8192px bounds.
    const resolution = Math.min(
      1,
      Math.sqrt(1_980_000 / (width * height)),
      8191 / width,
      8191 / height,
    );
    const w = Math.ceil(width * resolution),
      h = Math.ceil(height * resolution);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not render watermark text.");
    context.clearRect(0, 0, w, h);
    return { canvas, context, resolution };
  }

  draw(context: CanvasRenderingContext2D, run: SpriteRun) {
    context.drawImage(
      run.atlas,
      run.sx,
      run.sy,
      run.sw,
      run.sh,
      run.dx,
      run.dy,
      run.dw,
      run.dh,
    );
  }

  dispose() {
    for (const atlas of this.atlases) atlas.width = atlas.height = 0;
    this.atlases = [];
  }
}
