// Security-print line work (guilloche), drawn as SVG paths.

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Concentric rings whose radius ripples: ρ = R + amp·sin(kθ + i·phase). */
export function rings(
  cx: number,
  cy: number,
  count: number,
  r0: number,
  dr: number,
  k: number,
  amp: number,
  phase: number,
) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const radius = r0 + i * dr;
    for (let s = 0; s <= 200; s++) {
      const t = (s / 200) * Math.PI * 2;
      const rho = radius + amp * Math.sin(k * t + i * phase);
      d += `${s ? "L" : "M"}${round1(cx + rho * Math.cos(t))} ${round1(cy + rho * Math.sin(t))}`;
    }
    d += "Z";
  }
  return d;
}

/** Stacked sine waves across a band `width` wide. */
export function waves(
  width: number,
  count: number,
  y0: number,
  gap: number,
  amp: number,
  freq: number,
  shift: number,
) {
  let d = "";
  for (let j = 0; j < count; j++) {
    for (let x = 0; x <= width; x += 2) {
      const y = y0 + j * gap + amp * Math.sin(x * freq + j * shift);
      d += `${x ? "L" : "M"}${x} ${round1(y)}`;
    }
  }
  return d;
}

/**
 * Topographic contour lines for a 1600 × 700 view: gentle waves with a rise
 * on the right and a dip on the left.
 */
export function contours() {
  let d = "";
  for (let j = 0; j < 56; j++) {
    const base = -20 + j * 13;
    for (let x = 0; x <= 1600; x += 16) {
      const rise =
        70 * Math.exp(-(((x - 1240) / 230) ** 2 + ((base - 300) / 190) ** 2));
      const dip =
        -60 * Math.exp(-(((x - 330) / 210) ** 2 + ((base - 420) / 170) ** 2));
      const y =
        base +
        22 * Math.sin(x * 0.0036 + j * 0.075) +
        10 * Math.sin(x * 0.0095 - j * 0.19) +
        rise +
        dip;
      d += `${x ? "L" : "M"}${x} ${Math.round(y)}`;
    }
  }
  return d;
}
