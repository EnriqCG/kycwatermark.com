// Browser module served by Vite. Uses the app's sample, defaults and renderer.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Logo from "../src/Logo.tsx";
import { contours } from "../src/guilloche.ts";
import DeviceIcon from "../src/icon/DeviceIcon.tsx";
import {
  drawSampleDocument,
  loadSampleFonts,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
} from "../src/rendering/sampleDocument.ts";
import { renderWatermarkPreview } from "../src/rendering/watermarkPreview.ts";

async function loadIcon(component) {
  const theme = getComputedStyle(document.documentElement);
  const color = (name) => theme.getPropertyValue(`--color-${name}`).trim();
  const styles = `<style>
    .fill-paper { fill: ${color("paper")}; }
    .stroke-paper { stroke: ${color("paper")}; }
    .fill-redact { fill: ${color("redact")}; }
    .stroke-accent { stroke: ${color("accent")}; }
  </style>`;
  const svg = renderToStaticMarkup(createElement(component))
    .replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" color="${color("accent-ink")}" `)
    .replace("</svg>", `${styles}</svg>`);
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

export async function renderShareImage() {
  await loadSampleFonts();
  await document.fonts.load('400 72px "Bodoni Moda Variable"');
  await document.fonts.ready;
  const [logo, device] = await Promise.all([loadIcon(Logo), loadIcon(DeviceIcon)]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f6f1";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.save();
  ctx.translate(-120, 0);
  ctx.scale(0.9, 0.9);
  ctx.strokeStyle = "#1d6b50";
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.8 / 0.9;
  ctx.stroke(new Path2D(contours()));
  ctx.restore();

  ctx.fillStyle = "#e8ece5";
  ctx.beginPath();
  ctx.roundRect(652, 48, 600, 640, 28);
  ctx.fill();
  ctx.strokeStyle = "#d6ddd5";
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(652, 48, 600, 640, 28);
  ctx.clip();
  ctx.strokeStyle = "rgba(16, 36, 29, 0.045)";
  ctx.lineWidth = 1;
  for (let y = 53.5; y < 630; y += 6) {
    ctx.beginPath();
    ctx.moveTo(652, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.drawImage(logo, 72, 61, 36, 36);
  ctx.fillStyle = "#10241d";
  ctx.font = '600 24px "Geist Variable", sans-serif';
  ctx.letterSpacing = "-0.24px";
  ctx.fillText("KYCWatermark.com", 121, 88);
  ctx.font = '400 72px "Bodoni Moda Variable", serif';
  ctx.letterSpacing = "-1.44px";
  ctx.fillText("Watermark your", 72, 212);
  ctx.fillText("ID before you", 72, 296);
  const phrase = "hand it over.";
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(64, 318, ctx.measureText(phrase).width + 16, 72);
  ctx.fillStyle = "#fcfcf9";
  ctx.fillText(phrase, 72, 380);
  ctx.fillStyle = "#44564e";
  ctx.letterSpacing = "0px";
  ctx.font = '400 23px "Geist Variable", sans-serif';
  ctx.fillText("Black out what they don't", 72, 448);
  ctx.fillText("need and stamp who it's for.", 72, 481);
  ctx.fillStyle = "#e2ebe5";
  ctx.beginPath();
  ctx.roundRect(72, 519, 491, 48, 24);
  ctx.fill();
  ctx.fillStyle = "#155440";
  ctx.drawImage(device, 88, 532, 24, 24);
  ctx.font = '500 19px "Geist Variable", sans-serif';
  ctx.fillText("Runs in your browser. No data is sent anywhere.", 120, 550);

  ctx.fillStyle = "#44564e";
  ctx.font = '500 14px "Geist Mono Variable", monospace';
  ctx.letterSpacing = "1.68px";
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
      "Only for identity verification at Acme Bank · Nov 5, 2026",
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
