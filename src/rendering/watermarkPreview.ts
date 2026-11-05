import {
  getEffectiveWatermarkSpacing,
  getScaleFactor,
  type RedactionRect,
  recommendedStrength,
  scaleWatermarkSettings,
  type WatermarkSettings,
  wrapWatermarkText,
} from "../imageLogic";
import { renderWatermarkedImage } from "./watermarkRenderer";

// The editor, examples and generated share image start from the same settings.
export const defaultWatermarkSettings: WatermarkSettings = {
  text: "Only for verification at [Company]",
  pattern: "woven",
  ...recommendedStrength.values,
  angle: -24,
  color: "#353B46",
  grayscale: false,
  offsetX: 0,
  offsetY: 0,
  lineGap: 12,
  stagger: 0,
};

export const previewPatternSeed = 0x4b5943;

export function getWatermarkFont(fontSize: number) {
  return `600 ${fontSize}px "Avenir Next", "Sora", "Manrope", "Trebuchet MS", "Segoe UI", sans-serif`;
}

/** Examples use the production renderer, including actual glyph deformation. */
export function renderWatermarkPreview(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  text: string,
  settings = defaultWatermarkSettings,
  redactions: readonly RedactionRect[] = [],
) {
  const { width, height } = context.canvas;
  const scaled = scaleWatermarkSettings(
    settings,
    getScaleFactor(width, height),
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
    width,
    height,
    watermarked: true,
    grayscale: settings.grayscale,
    redactions,
    lines,
    text,
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
    pattern: settings.pattern,
    textureDensity: settings.textureDensity,
    wovenFontSize: scaled.wovenFontSize,
    waveFrequency: settings.waveFrequency,
    letterWarp: settings.letterWarp,
    patternSeed: previewPatternSeed,
  });
}
