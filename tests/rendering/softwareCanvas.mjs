const identity = [1, 0, 0, 1, 0, 0];

function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function inverse(m) {
  const determinant = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / determinant,
    -m[1] / determinant,
    -m[2] / determinant,
    m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant,
    (m[1] * m[4] - m[0] * m[5]) / determinant,
  ];
}

function transformPoint(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function parseColor(value) {
  const hex = value.startsWith("#") ? value.slice(1) : "000000";
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16), 255];
}

export class SoftwareCanvasContext {
  constructor(width, height) {
    this.canvas = { width, height };
    this.pixels = new Uint8ClampedArray(width * height * 4);
    this.stack = [];
    this.state = { transform: identity, alpha: 1, composite: "source-over", fillStyle: "#000000", filter: "none", font: "10px test", textAlign: "start", textBaseline: "alphabetic" };
  }

  get globalCompositeOperation() { return this.state.composite; }
  set globalCompositeOperation(value) { this.state.composite = value; }
  get filter() { return this.state.filter; }
  set filter(value) { this.state.filter = value; }
  get globalAlpha() { return this.state.alpha; }
  set globalAlpha(value) { this.state.alpha = value; }
  get fillStyle() { return this.state.fillStyle; }
  set fillStyle(value) { this.state.fillStyle = value; }
  get font() { return this.state.font; }
  set font(value) { this.state.font = value; }
  get textAlign() { return this.state.textAlign; }
  set textAlign(value) { this.state.textAlign = value; }
  get textBaseline() { return this.state.textBaseline; }
  set textBaseline(value) { this.state.textBaseline = value; }

  save() { this.stack.push({ ...this.state, transform: [...this.state.transform] }); }
  restore() { this.state = this.stack.pop(); }
  clearRect(x, y, width, height) {
    for (let py = Math.max(0, y); py < Math.min(this.canvas.height, y + height); py++) {
      this.pixels.fill(0, (py * this.canvas.width + Math.max(0, x)) * 4, (py * this.canvas.width + Math.min(this.canvas.width, x + width)) * 4);
    }
  }
  translate(x, y) { this.state.transform = multiply(this.state.transform, [1, 0, 0, 1, x, y]); }
  transform(a, b, c, d, e, f) { this.state.transform = multiply(this.state.transform, [a, b, c, d, e, f]); }
  rotate(angle) { this.state.transform = multiply(this.state.transform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]); }

  blendPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const index = (y * this.canvas.width + x) * 4;
    const alpha = (color[3] / 255) * this.state.alpha;
    const destinationAlpha = this.pixels[index + 3] / 255;
    if (this.state.composite === "lighter") {
      const resultAlpha = Math.min(1, alpha + destinationAlpha);
      for (let channel=0;channel<3;channel++) this.pixels[index+channel] = resultAlpha === 0 ? 0 : Math.round(Math.min(255, color[channel]*alpha + this.pixels[index+channel]*destinationAlpha)/resultAlpha);
      this.pixels[index+3] = Math.round(255*resultAlpha);
      return;
    }
    const resultAlpha = alpha + destinationAlpha * (1 - alpha);
    for (let channel = 0; channel < 3; channel++) this.pixels[index + channel] = resultAlpha === 0 ? 0 : Math.round((color[channel] * alpha + this.pixels[index + channel] * destinationAlpha * (1 - alpha)) / resultAlpha);
    this.pixels[index + 3] = Math.round(255 * resultAlpha);
  }

  fillRect(x, y, width, height) {
    const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => transformPoint(this.state.transform, px, py));
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.x))));
    const maxX = Math.min(this.canvas.width, Math.ceil(Math.max(...corners.map((point) => point.x))));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.y))));
    const maxY = Math.min(this.canvas.height, Math.ceil(Math.max(...corners.map((point) => point.y))));
    const inverted = inverse(this.state.transform);
    const color = parseColor(this.state.fillStyle);
    for (let py = minY; py < maxY; py++) for (let px = minX; px < maxX; px++) {
      const local = transformPoint(inverted, px + 0.5, py + 0.5);
      if (local.x >= x && local.x < x + width && local.y >= y && local.y < y + height) this.blendPixel(px, py, color);
    }
  }

  drawImage(source, ...args) {
    let sx = 0, sy = 0, sw = source.width, sh = source.height;
    let dx, dy, dw, dh;
    if (args.length === 2) [dx, dy, dw, dh] = [...args, sw, sh];
    else if (args.length === 4) [dx, dy, dw, dh] = args;
    else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    const corners = [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]].map(([x, y]) => transformPoint(this.state.transform, x, y));
    const minX = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))));
    const maxX = Math.min(this.canvas.width, Math.ceil(Math.max(...corners.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))));
    const maxY = Math.min(this.canvas.height, Math.ceil(Math.max(...corners.map(p => p.y))));
    const inverted = inverse(this.state.transform);
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      const local = transformPoint(inverted, x + 0.5, y + 0.5);
      if (local.x < dx || local.x >= dx + dw || local.y < dy || local.y >= dy + dh) continue;
      const sourceX = Math.min(source.width - 1, Math.max(0, Math.floor(sx + ((local.x - dx) / dw) * sw)));
      const sourceY = Math.min(source.height - 1, Math.max(0, Math.floor(sy + ((local.y - dy) / dh) * sh)));
      const index = (sourceY * source.width + sourceX) * 4;
      let color = Array.from(source.data.slice(index, index + 4));
      if (this.state.filter === "grayscale(100%)") {
        const gray = Math.round(color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114);
        color = [gray, gray, gray, color[3]];
      }
      this.blendPixel(x, y, color);
    }
  }

  measureText(text) {
    const fontSize = Number.parseFloat(this.state.font.match(/([\d.]+)px/)?.[1] ?? "10");
    const scale = Math.max(1, Math.round(fontSize / 7));
    return { width: Math.max(0, text.length * 4 * scale - scale) };
  }

  fillText(text, centerX, centerY) {
    const fontSize = Number.parseFloat(this.state.font.match(/([\d.]+)px/)?.[1] ?? "10");
    const scale = Math.max(1, Math.round(fontSize / 7));
    const width = this.measureText(text).width;
    const originX = this.state.textAlign === "center" ? centerX - width / 2 : centerX;
    const originY = this.state.textBaseline === "middle" ? centerY - (5 * scale) / 2 : centerY - 5 * scale;
    for (let characterIndex = 0; characterIndex < text.length; characterIndex++) {
      const code = text.charCodeAt(characterIndex);
      for (let row = 0; row < 5; row++) for (let column = 0; column < 3; column++) {
        // A fixed test-only bitmap font: spaces are blank; other glyphs derive
        // reproducibly from their character code and always retain edge pixels.
        const on = text[characterIndex] !== " " && (column === 0 || column === 2 || ((code >> ((row + column) % 7)) & 1) === 1);
        if (on) this.fillRect(originX + (characterIndex * 4 + column) * scale, originY + row * scale, scale, scale);
      }
    }
  }
}

export function makeSyntheticImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    data[index] = (x * 7 + y * 3) % 256;
    data[index + 1] = (x * 2 + y * 11) % 256;
    data[index + 2] = ((x >> 3) % 2 === (y >> 3) % 2) ? 230 : 35;
    data[index + 3] = 255;
  }
  return { width, height, data };
}


// Canvas sizing resets its storage and context, as in a browser. Expose .data
// only for this deterministic raster harness; production uses real canvas APIs.
export function makeSoftwareCanvas() {
  let width = 0, height = 0, context;
  const canvas = {
    get width() { return width; },
    set width(value) { width = value; context = new SoftwareCanvasContext(width, height); context.canvas = canvas; },
    get height() { return height; },
    set height(value) { height = value; context = new SoftwareCanvasContext(width, height); context.canvas = canvas; },
    get data() { return context.pixels; },
    getContext() { return context; },
  };
  canvas.width = canvas.height = 0;
  return canvas;
}
