/** Smooth fields in diagonal/1000 reference units. No document offsets enter
 * these functions: Position is a rigid translation of one seeded pattern. */
export function createWovenWave({
  base,
  amplitude,
  frequency,
  phase,
  secondaryPhase,
  ripplePhase,
  rippleAmplitude,
  variation,
  row,
}: {
  base: number;
  amplitude: number;
  frequency: number;
  phase: number;
  secondaryPhase: number;
  ripplePhase: number;
  rippleAmplitude: number;
  variation: number;
  row: number;
}) {
  const amplitudeDepth = 0.28 * variation;
  const frequencyDepth = 0.24 * variation;
  const amplitudePhase = secondaryPhase + row * 0.055;
  const frequencyPhase = ripplePhase - row * 0.008;
  const localFrequency = (x: number) =>
    frequency * (1 + frequencyDepth * Math.sin(x / 410 + frequencyPhase));
  // Exact integral of localFrequency, anchored at x=0. Substituting k(x)*x
  // would introduce an extra x*k'(x) term and produce an unintended chirp.
  const phaseAt = (x: number) =>
    phase +
    frequency *
      (x +
        frequencyDepth *
          410 *
          (Math.cos(frequencyPhase) - Math.cos(x / 410 + frequencyPhase)));
  const amplitudeAt = (x: number) =>
    amplitude * (1 + amplitudeDepth * Math.sin(x / 280 + amplitudePhase));
  const sample = (x: number) => {
    const psi = phaseAt(x),
      k = localFrequency(x),
      a = amplitudeAt(x);
    const da =
      ((amplitude * amplitudeDepth) / 280) * Math.cos(x / 280 + amplitudePhase);
    return {
      y:
        base +
        a * Math.sin(psi) +
        5 * Math.sin(x / 173 + secondaryPhase) +
        rippleAmplitude * Math.sin(2.3 * psi + ripplePhase),
      slope:
        da * Math.sin(psi) +
        a * k * Math.cos(psi) +
        (5 / 173) * Math.cos(x / 173 + secondaryPhase) +
        rippleAmplitude * 2.3 * k * Math.cos(2.3 * psi + ripplePhase),
    };
  };
  // Includes the envelope derivative and BOTH other harmonics; A*k alone is
  // not a slope bound. Used for a constant height on connected shaped strips.
  const slopeBound =
    (amplitude * amplitudeDepth) / 280 +
    amplitude * (1 + amplitudeDepth) * frequency * (1 + frequencyDepth) +
    5 / 173 +
    rippleAmplitude * 2.3 * frequency * (1 + frequencyDepth);
  return { sample, phaseAt, localFrequency, amplitudeAt, slopeBound };
}

/** Sideways ripple through the height of the actual ink. Vertical stems curve
 * too, even where the row baseline is locally straight. The mapping (u,v) ->
 * (u + displacement(v),v) has determinant 1, with no folds or stretched joins. */
export function glyphRipple(yEm: number, variation: number): number {
  return 0.06 * variation * Math.sin((2 * Math.PI * yEm) / 1.8 + 2);
}

/** Integrate dx/ds, where s is the unwarped advance. Bounded midpoint steps
 * keep wide graphemes (including emoji) spaced along the same modulated curve. */
export function advanceWovenText(
  x: number,
  width: number,
  frequency: number,
  slope: (x: number) => number,
  widthAt: (x: number) => number,
): number {
  const start = x;
  const steps = Math.max(1, Math.ceil((width * frequency) / 0.22));
  const ds = width / steps;
  for (let i = 0; i < steps; i++) {
    const estimate = (ds * widthAt(x)) / Math.hypot(1, slope(x));
    const mid = x + estimate / 2;
    x += (ds * widthAt(mid)) / Math.hypot(1, slope(mid));
  }
  return x - start;
}
