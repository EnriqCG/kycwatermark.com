import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderWatermarkedImage, WatermarkLayerCache } from "../../.test-build/rendering/watermarkRenderer.js";
import { makeSyntheticImage, makeSoftwareCanvas, SoftwareCanvasContext } from "./softwareCanvas.mjs";

globalThis.document = {
  createElement: (tag) => tag === "canvas" ? makeSoftwareCanvas() : { style: {}, remove() {} },
  body: { append() {} },
};
globalThis.getComputedStyle = () => ({ direction: "ltr" });

const width = 96;
const height = 64;
const source = makeSyntheticImage(width, height);
const here = dirname(fileURLToPath(import.meta.url));

const defaults = {
  width,
  height,
  watermarked: true,
  grayscale: true,
  redactions: [],
  lines: ["KYC ONLY"],
  opacity: 0.4,
  color: "#353b46",
  font: '600 7px "Golden Test Bitmap"',
  angleDegrees: -32,
  offsetX: 0,
  offsetY: 0,
  spacingX: 42,
  spacingY: 18,
  fontSize: 7,
  lineGap: 3,
  stagger: 0,
  pattern: "text",
  textureDensity: 0.75,
  wovenFontSize: 1.15,
  waveFrequency: 3,
  letterWarp: 0.65,
  patternSeed: 0x4b5943,
};

const scenarios = {
  "default-watermark": defaults,
  "color-multiline-offset-stagger": { ...defaults, grayscale: false, lines: ["ONLY FOR", "ACME 2026"], opacity: 0.62, color: "#b42318", angleDegrees: 18, offsetX: 7, offsetY: -4, spacingX: 48, spacingY: 25, lineGap: 2, stagger: 11 },
  "rotated-overlapping-redactions": { ...defaults, lines: ["PRIVATE"], grayscale: false, opacity: 0.25, redactions: [{ x: 9, y: 11, w: 31, h: 13, angle: Math.PI / 12 }, { x: 29, y: 20, w: 42, h: 17, angle: -Math.PI / 7 }] },
  "original-has-no-transformations": { ...defaults, watermarked: false, redactions: [{ x: 1, y: 1, w: 90, h: 60, angle: 0 }] },
  "woven-bold": { ...defaults, pattern: "woven", opacity: 0.48, grayscale: false },
  "woven-dense-offset": { ...defaults, pattern: "woven", textureDensity: 1, patternSeed: 7183, offsetX: 20, offsetY: -17, angleDegrees: 60, opacity: 0.44, color: "#b42318" },
};

// Exact hashes of decoded RGBA buffers—not encoded image bytes.
const approved = {
  "default-watermark": "14855f076ccbc699a75f6082bcb6e5248c37a54ceff5b788fee2a12d2ea7eddd",
  "color-multiline-offset-stagger": "825ea50e3ae667faab5ed79a6ba326fada06a0f335342f017e0ed37139828866",
  "rotated-overlapping-redactions": "444ac9bd89b0836554efd46d38831cb94c4f4f751d13a370b7635231c3d7a2f5",
  "original-has-no-transformations": "ebb9eff40a5faafc6b1235a317e058576f2b9fbd7ba03d6d8277e6ccde4e6fed",
  "woven-bold": "cbcb1b5bf7209212c2b92902b5848e23e4f6546b6c42f98d0915e5356057d368",
  "woven-dense-offset": "f97712311478cdbfa30ae7238a6b348d1dfb3dfe5d77d613cdfaa6c4518e5e3e",
};

function hash(pixels) { return createHash("sha256").update(pixels).digest("hex"); }

function writePpm(name, pixels) {
  const artifactDirectory = resolve(here, "../artifacts");
  mkdirSync(artifactDirectory, { recursive: true });
  const rgb = Buffer.alloc(width * height * 3);
  for (let from = 0, to = 0; from < pixels.length; from += 4) {
    rgb[to++] = pixels[from];
    rgb[to++] = pixels[from + 1];
    rgb[to++] = pixels[from + 2];
  }
  const path = resolve(artifactDirectory, `${name}.actual.ppm`);
  writeFileSync(path, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), rgb]));
  return path;
}

function render(options, input = source) {
  const context = new SoftwareCanvasContext(width, height);
  renderWatermarkedImage(context, input, { ...defaults, pattern: "woven", ...options });
  return context.pixels;
}

test("a document seed reproduces identical pixels after other renders", () => {
  const before = render({ patternSeed: 42 });
  render({ patternSeed: 42, textureDensity: 1, opacity: 0.55 });
  assert.deepEqual(render({ patternSeed: 42 }), before);
  assert.notDeepEqual(render({ patternSeed: 43 }), before);
});

test("coverage and text-only selection change the rendered pattern", () => {
  const woven = render({});
  assert.notDeepEqual(render({ textureDensity: 0.3 }), woven);
  assert.notDeepEqual(render({ wovenFontSize: defaults.wovenFontSize * 1.5 }), woven);
  assert.notDeepEqual(render({ pattern: "text" }), woven);
});

test("wave frequency and letter variation independently change woven output", () => {
  const normal = render({});
  assert.notDeepEqual(render({ waveFrequency: 1 }), normal);
  assert.notDeepEqual(render({ letterWarp: 0 }), normal);
  assert.notDeepEqual(render({ waveFrequency: 5, letterWarp: 1 }), normal);
  assert.deepEqual(render({ pattern: "text", waveFrequency: 5, letterWarp: 1 }), render({ pattern: "text", waveFrequency: 1, letterWarp: 0 }));
});

test("letter deformation stays finite and never mirrors or collapses glyphs", () => {
  for (const letterWarp of [0, 0.65, 1]) {
    const context = new SoftwareCanvasContext(width, height);
    const transform = context.transform.bind(context);
    let count = 0;
    context.transform = (a, b, c, d, e, f) => {
      assert.ok([a, b, c, d, e, f].every(Number.isFinite));
      assert.ok(a >= 0.8 && a <= 1.2 && d >= 0.65 && d <= 1.35);
      assert.ok(a * d - b * c > 0.5);
      if (letterWarp === 0) assert.ok([a, b, c, d, e, f].every((value, index) => value === [1, 0, 0, 1, 0, 0][index]));
      count++;
      transform(a, b, c, d, e, f);
    };
    renderWatermarkedImage(context, source, { ...defaults, pattern: "woven", waveFrequency: 5, letterWarp });
    assert.ok(count > 100);
    assert.deepEqual(context.state.transform, [1, 0, 0, 1, 0, 0]);
  }
});

test("woven uses curved text without decorative strokes or large stamps", () => {
  const context = new SoftwareCanvasContext(width, height);
  context.stroke = () => assert.fail("woven lines must consist of text");
  const drawImage = context.drawImage.bind(context);
  let glyphCount = 0;
  context.fillText = () => assert.fail("woven destination must not use transformed fillText");
  context.drawImage = (...args) => { glyphCount++; drawImage(...args); };
  renderWatermarkedImage(context, source, { ...defaults, pattern: "woven" });
  assert.ok(glyphCount > 100, "woven should contain dense repeated purpose text");
  assert.deepEqual(render({ textureDensity: 0 }), render({ opacity: 0 }));
});

test("redacted pixels cannot depend on the hidden source, at any strength", () => {
  const black = { width, height, data: Uint8ClampedArray.from(source.data, (_, i) => i % 4 === 3 ? 255 : 0) };
  const white = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
  for (const opacity of [0, 0.24, 0.36, 0.48, 0.44]) {
    const options = { opacity, redactions: [{ x: 12, y: 16, w: 36, h: 24, angle: 0 }] };
    const a = render(options, black), b = render(options, white);
    for (let y = 16; y < 40; y++) for (let x = 12; x < 48; x++) {
      const index = (y * width + x) * 4;
      assert.deepEqual(a.slice(index, index + 4), b.slice(index, index + 4));
      assert.equal(a[index + 3], 255);
    }
  }
});

test("empty text and zero opacity omit the entire pattern but retain redactions", () => {
  const redactions = [{ x: 12, y: 16, w: 36, h: 24, angle: 0 }];
  assert.deepEqual(render({ lines: [], redactions }), render({ opacity: 0, redactions }));
  assert.notDeepEqual(render({ opacity: 0, redactions }), render({ opacity: 0 }));
});

test("compare mode returns the source without texture, grayscale or redactions", () => {
  assert.deepEqual(render({ watermarked: false, redactions: [{ x: 0, y: 0, w: width, h: height, angle: 0 }] }), source.data);
});

for (const [name, options] of Object.entries(scenarios)) {
  test(`golden RGBA output: ${name}`, () => {
    const context = new SoftwareCanvasContext(width, height);
    renderWatermarkedImage(context, source, options);
    const actual = hash(context.pixels);
    if (process.env.UPDATE_GOLDEN_HASHES === "1") {
      console.log(`${JSON.stringify(name)}: ${JSON.stringify(actual)},`);
      return;
    }
    if (actual !== approved[name]) {
      const artifact = writePpm(name, context.pixels);
      assert.equal(actual, approved[name], `decoded RGBA changed; inspect ${artifact}`);
    }
  });
}

// Proportional metrics and no rasterization for geometry/work budgets. The bitmap
// goldens deliberately do not claim to establish browser typography.
function recordingCanvas(records = []) {
  let width = 0, height = 0;
  const context = new SoftwareCanvasContext(1, 1);
  context.measureText = (text) => ({ width: [...text].length * Number.parseFloat(context.font.match(/([\d.]+)px/)[1]) * 0.6 });
  context.fillText = (text) => records.push({ kind: "text", text, font: context.font });
  context.clearRect = context.fillRect = () => {};
  context.drawImage = (source, ...args) => records.push({ kind: "image", source, target: context.canvas, composite: context.globalCompositeOperation, sourceSize: [source.width, source.height], targetSize: [context.canvas.width, context.canvas.height], args, matrix: [...context.state.transform] });
  const canvas = {
    get width() { return width; }, set width(v) { width = v; },
    get height() { return height; }, set height(v) { height = v; },
    getContext() { return context; },
  };
  context.canvas = canvas;
  return canvas;
}

const { segmentWovenText } = await import("../../.test-build/rendering/wovenText.js");

test("independent scripts and symbols follow individual intact graphemes", () => {
  for (const text of ["仅限招商银行身份验证使用", "2026年11月5日", "Ελληνικά Сбербанке", "Acme€Bank+KYC=verified"]) {
    const plan = segmentWovenText(text);
    assert.equal(plan.shaped, false);
    assert.equal(plan.tokens.join(""), `${text} · `);
    assert.ok(plan.tokens.every(token => [...token].length <= 2));
  }
  const text = "a\u0308\u0323 👨‍👩‍👧‍👦 🏳️‍🌈 🇪🇸";
  const plan = segmentWovenText(text);
  assert.equal(plan.tokens.join(""), `${text} · `);
  for (const cluster of ["a\u0308\u0323", "👨‍👩‍👧‍👦", "🏳️‍🌈", "🇪🇸"]) assert.ok(plan.tokens.includes(cluster));
});

test("bidi, digits and joining scripts stay in one unchanged browser-shaped paragraph", () => {
  for (const text of ["للتحقق من الهوية", "עברית Acme 123 / ٤٥٦", "Only بنك Acme 123 للتحقق", "ภาษาไทยไม่มีช่องว่าง", "हिन्दी क्‍ष", "abc\u202e123\u202c"]) {
    const plan = segmentWovenText(text);
    assert.equal(plan.shaped, true);
    assert.deepEqual(plan.tokens, [`${text} · `]);
    const records = [];
    const dest = recordingCanvas(records);
    const cache = new WatermarkLayerCache(() => recordingCanvas(records));
    renderWatermarkedImage(dest.getContext("2d"), source, { ...defaults, pattern: "woven", text }, cache);
    const draws = records.filter(r => r.kind === "text");
    assert.equal(draws.length, 2, "shape once at each of the two row sizes");
    assert.ok(draws.every(r => r.text === `${text} · `), "browser sees original logical order, marks and joins");
    const strips = records.filter(r => r.kind === "image" && r.args.length === 8 && r.args[3] !== 1);
    assert.ok(strips.length > 100);
    assert.ok(strips.every(r => r.args[6] < defaults.wovenFontSize * 2), "complex text follows curve in narrow slices");
    cache.clear();
  }
});

test("watermark layer reuses across boxes, grayscale and comparison; every pattern input invalidates", () => {
  const canvases = [];
  const cache = new WatermarkLayerCache(() => { const canvas = recordingCanvas(); canvases.push(canvas); return canvas; });
  const options = { ...defaults, pattern: "woven", text: "Only for Acme" };
  const first = cache.get(source, options);
  assert.equal(cache.get(source, { ...options, grayscale: false, watermarked: false, redactions: [{ x: 1, y: 2, w: 3, h: 4, angle: 0 }] }), first);
  for (const [key, value] of Object.entries({width:97,height:65,text:"Other",lines:["Other"],fontRevision:1,opacity:0.9,color:"#ff0000",font:"600 9px test",angleDegrees:2,offsetX:3,offsetY:4,spacingX:55,spacingY:25,fontSize:8,lineGap:4,stagger:2,pattern:"text",textureDensity:0.9,wovenFontSize:2,waveFrequency:4,letterWarp:0.8,patternSeed:42})) {
    const before = cache.get(source, options);
    const after = cache.get(source, { ...options, [key]: value });
    assert.notEqual(after, before, `${key} must invalidate`);
    assert.equal(before.width, 0, "discarded layer is released");
  }
  const before = cache.get(source, options);
  assert.notEqual(cache.get({ ...source }, options), before, "new document invalidates at identical size and settings");
  cache.clear();
  assert.ok(canvases.every(c => c.width === 0 && c.height === 0), "all layers and sprite atlases are released");
  assert.equal(cache.get(source, { ...options, width: 5000, height: 4000 }), null, "large documents do not retain an oversized layer");
});

test("cached protected export preserves opaque redactions independently of comparison", () => {
  const cache = new WatermarkLayerCache(makeSoftwareCanvas);
  const black = { width, height, data: Uint8ClampedArray.from(source.data, (_, i) => i % 4 === 3 ? 255 : 0) };
  const white = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
  const rect = { x: 12, y: 16, w: 36, h: 24, angle: 0 };
  const options = { ...defaults, pattern: "woven", redactions: [rect] };
  const protectedPixels = [];
  for (const input of [black, white]) {
    const ctx = new SoftwareCanvasContext(width, height);
    renderWatermarkedImage(ctx, input, options, cache);
    protectedPixels.push(ctx.pixels.slice());
    renderWatermarkedImage(ctx, input, { ...options, watermarked: false }, cache);
    assert.deepEqual(ctx.pixels, input.data);
    renderWatermarkedImage(ctx, input, options, cache);
    assert.deepEqual(ctx.pixels, protectedPixels.at(-1), "fresh export is protected after Hold to compare");
  }
  for (let y = 16; y < 40; y++) for (let x = 12; x < 48; x++) {
    const i = (y * width + x) * 4;
    assert.deepEqual(protectedPixels[0].slice(i, i + 4), protectedPixels[1].slice(i, i + 4));
    assert.equal(protectedPixels[0][i+3], 255);
  }
  cache.clear();
});

test("Position translates seeded glyphs rigidly, including at maximum offsets", () => {
  const collect = (offsetX, offsetY) => {
    const records = [];
    const dest = recordingCanvas(records);
    const cache = new WatermarkLayerCache(() => recordingCanvas(records));
    renderWatermarkedImage(dest.getContext("2d"), source, { ...defaults, pattern:"woven", width:1000, height:1000, wovenFontSize:10, offsetX, offsetY }, cache);
    cache.clear();
    return records.filter(r => r.kind === "image" && r.args.length === 8).map(r => {
      const m = [...r.matrix]; m[4] -= offsetX; m[5] -= offsetY;
      return { key: [...m, ...r.args].map(n => Number(n.toFixed(7))).join(","), x:m[4], y:m[5] };
    });
  };
  const base = collect(0,0), keys = new Set(base.map(r => r.key));
  for (const [x,y] of [[1,5],[40,-30],[200*Math.SQRT2,-200*Math.SQRT2]]) {
    const shifted = collect(x,y).filter(r => r.x > 30 && r.x < 970 && r.y > 30 && r.y < 970);
    assert.ok(shifted.length > 100);
    assert.ok(shifted.every(r => keys.has(r.key)), "all common interior glyph matrices are unchanged in pattern coordinates");
  }
});

test("maximum settings have bounded glyph operations and no destination text calls", () => {
  const records = [], canvases = [];
  const dest = recordingCanvas(records);
  const cache = new WatermarkLayerCache(() => { const c = recordingCanvas(records); canvases.push(c); return c; });
  const options = { ...defaults,width:1712,height:1080,pattern:"woven",text:"Only for verification at Acme Bank · 5 Nov 2026",wovenFontSize:6*Math.hypot(1712,1080)/1000,textureDensity:1,waveFrequency:5,letterWarp:1 };
  renderWatermarkedImage(dest.getContext("2d"), source, options, cache);
  const glyphs = records.filter(r => r.kind === "image" && r.args.length === 8).length;
  assert.ok(glyphs > 10000 && glyphs < 30000, `glyph budget: ${glyphs}`);
  assert.ok(records.filter(r => r.kind === "text").length < 100, "unique grapheme rasterizations only");
  assert.ok(canvases.slice(1).every(c => c.width === 0 && c.height === 0), "atlases released after pattern render");
  const before = records.length;
  renderWatermarkedImage(dest.getContext("2d"), source, { ...options, redactions:[{x:1,y:2,w:20,h:30,angle:0}] }, cache);
  assert.equal(records.length-before,2,"drag recomposition draws source and cached layer only");
  cache.clear();
});

test("cached and direct compositing differ only by transparent-layer rounding", () => {
  for (const letterWarp of [0, 0.65, 1]) {
    const options = { ...defaults, pattern:"woven", letterWarp, redactions:[{x:12,y:16,w:36,h:24,angle:0.1}] };
    const direct = new SoftwareCanvasContext(width,height), cached = new SoftwareCanvasContext(width,height);
    const cache = new WatermarkLayerCache(makeSoftwareCanvas);
    renderWatermarkedImage(direct,source,options);
    renderWatermarkedImage(cached,source,options,cache);
    assert.ok(direct.pixels.every((value,i) => Math.abs(value-cached.pixels[i])<=2));
    cache.clear();
  }
});

test("failed rasterization releases all temporary and retained canvases", () => {
  const canvases=[];
  const cache=new WatermarkLayerCache(()=>{
    const canvas=recordingCanvas();canvases.push(canvas);
    if(canvases.length===3)canvas.getContext=()=>null;
    return canvas;
  });
  assert.throws(()=>cache.get(source,{...defaults,pattern:"woven"}),/Could not render/);
  assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});

test("long browser-shaped paragraphs keep sprite atlases within their pixel budget", () => {
  const sizes=[];
  const cache=new WatermarkLayerCache(()=>{
    const canvas=recordingCanvas();
    canvas.getContext("2d").fillText=()=>sizes.push([canvas.width,canvas.height]);
    return canvas;
  });
  cache.get(source,{...defaults,width:1712,height:1080,pattern:"woven",wovenFontSize:44,text:"للتحقق من الهوية Acme 123 ".repeat(100)});
  assert.equal(sizes.length,2);
  assert.ok(sizes.every(([w,h])=>w<=8192&&h<=8192&&w*h<=2_000_000));
  cache.clear();
});

const { createWovenWave, glyphRipple, advanceWovenText } = await import("../../.test-build/rendering/wovenGeometry.js");
const waveFixture = (row = 0, variation = 1, frequency = 5 / 55) => createWovenWave({
  base: row * 9.072, amplitude: 24 / Math.sqrt(5), frequency,
  phase: 1.3 + row * 0.065, secondaryPhase: 2.1 + row * 0.04,
  ripplePhase: 0.7, rippleAmplitude: 1.6, variation, row,
});

test("glyph ink has a bounded non-affine ripple, decreasing continuously to zero", () => {
  let curvature = 0;
  for (let y = -1; y <= 1; y += .02) {
    const v = glyphRipple(y, 1);
    assert.ok(Math.abs(v) <= .06);
    assert.ok(glyphRipple(y, 0) === 0);
    assert.ok(Math.abs(glyphRipple(y, .65) - v * .65) < 1e-15);
    curvature = Math.max(curvature, Math.abs(glyphRipple(y+.1,1)-2*v+glyphRipple(y-.1,1)));
  }
  assert.ok(curvature > .006, "displacement cannot be an affine shear/translation");
  const records = [], dest = recordingCanvas(records);
  const cache = new WatermarkLayerCache(() => recordingCanvas(records));
  renderWatermarkedImage(dest.getContext("2d"), source, { ...defaults, width:1712, height:1080, pattern:"woven", wovenFontSize:24, letterWarp:.65 }, cache);
  const scans = records.filter(r => r.kind === "image" && r.args.length === 8 && r.args[3] === 1);
  assert.ok(scans.length > 100, "the non-affine scanlines are actually rasterized into the sprite atlas");
  assert.ok(scans.some(r => Math.abs(r.args[4]-r.args[0])>.2));
  assert.ok(scans.every(r => r.args[1] === r.args[5] && r.args[7] === 1), "integer y partitions cannot overlap or leave cracks");
  assert.ok(scans.every(r => r.targetSize[0]*r.targetSize[1] <= 2_000_000));
  cache.clear();
});

test("modulated wave tangents and integrated frequency match numerical derivatives", () => {
  for (const variation of [0,.65,1]) for (const row of [-90,0,80]) {
    const f = waveFixture(row, variation), h = 1e-3;
    for (let x=-950;x<=950;x+=7.1) {
      const sample=f.sample(x);
      assert.ok(Math.abs((f.sample(x+h).y-f.sample(x-h).y)/(2*h)-sample.slope)<1e-7);
      assert.ok(Math.abs((f.phaseAt(x+h)-f.phaseAt(x-h))/(2*h)-f.localFrequency(x))<1e-9);
      assert.ok(Math.abs(sample.slope)<=f.slopeBound+1e-10);
      assert.ok(f.localFrequency(x)>0);
      assert.ok(Math.abs(f.amplitudeAt(x)/(24/Math.sqrt(5))-1)<=.28*variation+1e-10);
    }
    if(variation===0) assert.equal(f.localFrequency(123),5/55);
  }
});

test("neighboring modulated rows retain smooth ordered baselines at slider maxima", () => {
  let minimum=Infinity, maximum=0;
  for(let row=-100;row<100;row++) {
    const a=waveFixture(row), b=waveFixture(row+1);
    for(let x=-950;x<=950;x+=3) {
      const gap=b.sample(x).y-a.sample(x).y;
      minimum=Math.min(minimum,gap);maximum=Math.max(maximum,gap);
    }
  }
  assert.ok(minimum>5.5 && maximum<12.7, `neighbor baseline gap ${minimum}–${maximum}`);
});

test("advance integrates the same changing tangent and width field without bunching", () => {
  for(const frequency of [1/90,3/70,5/55]) for(const variation of [0,.65,1]) {
    const f=waveFixture(6,variation,frequency);
    const slope=x=>f.sample(x).slope;
    const widthAt=x=>1+.18*variation*Math.sin(x*frequency*1.7+1.1);
    for(const width of [3.6,7.2,26.4,70.4]) for(let x=-900;x<900;x+=31.7) {
      const dx=advanceWovenText(x,width,frequency,slope,widthAt);
      assert.ok(Number.isFinite(dx)&&dx>0);
      let arc=0;const n=100;
      for(let i=0;i<n;i++){const p=x+dx*(i+.5)/n;arc+=Math.hypot(1,slope(p))/widthAt(p)*dx/n;}
      assert.ok(Math.abs(arc/width-1)<.015, `relative spacing error ${arc/width-1}`);
    }
  }
});

test("connected visual slices share boundary positions and height before one row rotation", () => {
  const records=[], canvases=[], dest=recordingCanvas(records);
  const cache=new WatermarkLayerCache(()=>{const c=recordingCanvas(records);canvases.push(c);return c;});
  renderWatermarkedImage(dest.getContext("2d"),source,{...defaults,width:1712,height:1080,pattern:"woven",text:"للتحقق من الهوية Acme Bank 123 हिन्दी",wovenFontSize:24,letterWarp:1},cache);
  const strips=records.filter(r=>r.kind==="image"&&r.args.length===8&&r.args[3]!==1);
  assert.ok(strips.every(r=>r.composite === "lighter"), "only connected row interiors add edge coverage");
  let matched=0;
  const point=(r,x)=>[r.matrix[0]*x+r.matrix[4],r.matrix[1]*x+r.matrix[5]];
  for(let i=1;i<strips.length;i++){
    const a=strips[i-1],b=strips[i];
    if(a.target!==b.target||b.matrix[4]<=a.matrix[4]||a.args[6]>12||b.args[6]>12||Math.abs(a.args[0]+a.args[2]-b.args[0])>1e-7||a.args[1]!==b.args[1])continue;
    const right=point(a,a.args[4]+a.args[6]),left=point(b,b.args[4]);
    assert.ok(Math.hypot(right[0]-left[0],right[1]-left[1])<1e-7);
    assert.equal(a.matrix[2],0);assert.equal(a.matrix[3],b.matrix[3]);matched++;
  }
  assert.ok(matched>500);
  assert.equal(canvases.length,3,"one retained layer and only two temporary canvases");
  assert.ok(records.filter(r=>r.kind==="image"&&r.args.length===8).every(r=>r.targetSize[0]*r.targetSize[1]<=2_000_000&&r.targetSize.every(v=>v<=8192)));
  cache.clear();assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});

test("a direct sprite failure restores the caller transform as well as releasing atlases", () => {
  const dest=recordingCanvas(), ctx=dest.getContext("2d"), draw=ctx.drawImage;
  ctx.drawImage=(...args)=>{if(args.length===9)throw new Error("sprite failure");return draw(...args);};
  assert.throws(()=>renderWatermarkedImage(ctx,source,{...defaults,pattern:"woven"}),/sprite failure/);
  assert.equal(ctx.stack.length,0);
  assert.deepEqual(ctx.state.transform,[1,0,0,1,0,0]);
});

test("connected row composition remains rigid under Position, at both variation endpoints", () => {
  for(const letterWarp of [0,1]) {
    const collect=(offsetX,offsetY)=>{
      const records=[],cache=new WatermarkLayerCache(()=>recordingCanvas(records));
      cache.get(source,{...defaults,width:1712,height:1080,pattern:"woven",text:"للتحقق Acme 123 हिन्दी",wovenFontSize:24,letterWarp,offsetX,offsetY});
      cache.clear();
      return records.filter(r=>r.kind==="image"&&r.args.length===4&&r.sourceSize[1]>0).map(r=>{
        const m=[...r.matrix];m[4]-=offsetX;m[5]-=offsetY;
        return [...m,...r.args,...r.sourceSize].map(v=>Number(v.toFixed(7)));
      });
    };
    const baseline = new Map(collect(0,0).map(r=>[r[7],r]));
    const common = collect(220,-180).filter(r=>baseline.has(r[7]));
    assert.ok(common.length>10);
    for(const r of common)assert.deepEqual(r,baseline.get(r[7]),"same visible bounded rows, sampling origins, matrices and placement");
  }
});
