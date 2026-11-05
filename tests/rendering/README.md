# Rendering golden tests

`npm run test:golden` compiles the production renderer in isolation and runs it
against a synthetic 96×64 RGBA image. The six approved hashes cover the
legacy text-only grayscale watermark, colored multiline text with offsets and
row stagger, rotated/overlapping redactions, the untouched original-image path,
and woven patterns with fixed seeds, density, wave frequency, letter variation,
rotation and offsets. Behavior checks also verify that glyph deformation stays
finite and invertible, and that both new controls leave Straight text unchanged.

Additional checks cover reproducible document seeds, changed output for
different seeds/coverage, original comparison, and opaque redactions that do not
depend on the hidden source pixels even at zero watermark opacity. A proportional
recording context checks rigid offsets, finite glyph matrices, maximum-setting
operation counts, paragraph/grapheme preservation and layer cache ownership,
reuse and invalidation. The software harness supports transformed sprite crops
and transparent source-over composition; all four Straight text goldens retain
their previous hashes. The two Woven hashes include the bent sprite atlas, modulated wave field,
arc integration and fixed seeded walk origin. Additional geometry checks cover
non-affine ink curvature, variation endpoints, analytic wave/phase derivatives,
neighboring baseline clearance, arc spacing, shared connected-strip boundaries
and the two-canvas budget. The software compositor also supports additive
premultiplied coverage inside a connected row; rows still composite normally.

The comparison is over the final decoded RGBA buffer, so image encoder metadata
and compression cannot make the test flaky. On a mismatch, the test writes the
actual output as `tests/artifacts/<scenario>.actual.ppm` for visual inspection.
That directory is ignored by Git.

The software Canvas harness uses a small deterministic bitmap font. This makes
text geometry and compositing stable on every CI operating system, but it does
not characterize a browser's platform-dependent font rasterization. Browser
checks are still needed for actual typography and readability. These tests
detect rendering regressions; they do not establish resistance to watermark
removal. See [the rendering notes](../../docs/watermark-rendering.md).

To intentionally approve a rendering change, first inspect the failing PPM,
then run `UPDATE_GOLDEN_HASHES=1 npm run test:golden` and copy the printed hashes
into `approved` in `watermarkRenderer.test.mjs`. Run the normal command again to
verify the committed baselines.
