// Browser module served by Vite. Uses the app's sample, defaults and renderer.
import { contours } from "../src/guilloche.ts";
import {
  drawSampleDocument,
  loadSampleFonts,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
} from "../src/rendering/sampleDocument.ts";
import { renderWatermarkPreview } from "../src/rendering/watermarkPreview.ts";

export async function renderShareImage() {
  await loadSampleFonts();
  await document.fonts.load('500 72px "Bodoni Moda Variable"');
  await document.fonts.ready;
  const logo = new Image();
  logo.src = "/logo.svg";
  await logo.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f6f1";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.save();
  ctx.scale(0.75, 0.9);
  ctx.strokeStyle = "#d4e3d8";
  ctx.lineWidth = 0.8;
  ctx.stroke(new Path2D(contours()));
  ctx.restore();

  ctx.fillStyle = "#ecefe9";
  ctx.beginPath();
  ctx.roundRect(652, 48, 600, 640, 28);
  ctx.fill();
  ctx.strokeStyle = "#dde3db";
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(652, 48, 600, 640, 28);
  ctx.clip();
  ctx.strokeStyle = "#dfe5dc";
  ctx.lineWidth = 0.4;
  for (let y = 54; y < 630; y += 5) {
    ctx.beginPath();
    ctx.moveTo(652, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.drawImage(logo, 72, 61, 36, 36);
  ctx.fillStyle = "#10241d";
  ctx.font = '700 25px "Geist Variable", sans-serif';
  ctx.fillText("KYCWatermark.com", 121, 88);
  ctx.font = '500 72px "Bodoni Moda Variable", serif';
  ctx.fillText("Watermark your", 72, 210);
  ctx.fillText("ID before you", 72, 294);
  const phrase = "hand it over.";
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(65, 317, ctx.measureText(phrase).width + 16, 74);
  ctx.fillStyle = "#fcfcf9";
  ctx.fillText(phrase, 72, 380);
  ctx.fillStyle = "#44564e";
  ctx.font = '400 23px "Geist Variable", sans-serif';
  ctx.fillText("Black out what they don't", 72, 448);
  ctx.fillText("need and stamp who it's for.", 72, 481);
  ctx.fillStyle = "#e2ebe5";
  ctx.beginPath();
  ctx.roundRect(72, 519, 491, 48, 24);
  ctx.fill();
  ctx.fillStyle = "#155440";
  ctx.font = '500 18px "Geist Variable", sans-serif';
  ctx.fillText("Runs in your browser. No data is sent anywhere.", 96, 549);

  ctx.fillStyle = "#44564e";
  ctx.font = '500 14px "Geist Mono Variable", monospace';
  ctx.fillText("WHAT THE COMPANY RECEIVES", 684, 174);
  const source = document.createElement("canvas");
  const marked = document.createElement("canvas");
  source.width = marked.width = SAMPLE_WIDTH;
  source.height = marked.height = SAMPLE_HEIGHT;
  try {
    const redactions = drawSampleDocument(source.getContext("2d"));
    renderWatermarkPreview(
      marked.getContext("2d"),
      source,
      "Only for identity verification at Acme Bank · 5 Nov 2026",
      undefined,
      redactions,
    );
    ctx.save();
    ctx.shadowColor = "#10241d30";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#e3e9e2";
    ctx.beginPath();
    ctx.roundRect(684, 215, 480, 303, 14);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
    ctx.drawImage(marked, 684, 215, 480, 303);
    ctx.restore();
  } finally {
    source.width = source.height = marked.width = marked.height = 0;
  }
  return canvas;
}
