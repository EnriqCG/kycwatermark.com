# Watermark rendering

In Woven, the watermark text itself forms continuous, closely spaced curves.
There are no decorative line strokes or large stamps over those curves. Bold
is the default; its text rows are roughly three times closer than the initial
hybrid design. Subtle, Balanced, Bold and Dense change opacity, text size,
row density, wave frequency and letter variation together. Fine-tuning controls
expose each independently. Bold uses 3× wave frequency and 65% letter variation;
the Straight text option retains the previous regular stamp renderer and its
spacing controls.

## Design rationale

- Generate a seed with `crypto.getRandomValues` once when opening a document.
  Keep it in memory across edits, comparison and exports. A new upload receives
  a new seed; rerendering or downloading does not randomize the pattern.
- Derive wave amplitude, wavelength and phases from that seed. Smooth spatial
  envelopes vary amplitude by up to 28% and local frequency by up to 24% at
  full Letter variation. Both depths decrease with that control. Frequency is
  integrated to obtain phase; position, tangents and arc advances use the same
  field, including the amplitude-envelope derivative. Wavelength changes much
  more slowly between neighboring rows than along a row, keeping the flow
  coherent. Small seeded row spacing/opacity perturbations remain. Shorter waves
  retain reduced height and a finer baseline ripple. The seed is pattern
  variation, not a secret key or an authenticity proof.
- Every sixth row uses text 18% larger, maintaining some size variation without
  introducing large stamps. Small text remains vulnerable to downsampling;
  removal resistance and recipient readability still need separate assessment.
- Use the image diagonal as the layout reference so the relative pattern size
  is consistent across input resolutions. The original resolution is retained.
- Draw Latin letters along curve tangents and advance along the curve's arc
  to maintain spacing. Smoothly vary their width, height and slant along the
  curves. Account for the changed widths when advancing, and limit height
  variation on steeper slopes. Neighbouring rows can still touch at high
  settings; this is not a strict clearance guarantee. All glyph transforms remain
  positive and invertible. Letter variation at zero disables these glyph
  deformations and amplitude/frequency envelopes while retaining the curved
  baseline. Before placement, bend the actual glyph ink sideways with a smooth
  1.8-em-period ripple through its height, bounded to 0.06 em at full variation
  (0.039 em at Bold). This non-affine mapping curves stems within letters;
  its determinant is one, so it cannot mirror or fold ink. The ripple is baked
  once into the bounded atlas, rather than rerasterizing every occurrence.
  Large text relative to wavelength reduces both short-wave heights to limit
  collisions on inner bends; the local frequency remains unchanged.
  Segment independent scripts (including CJK, Greek and Cyrillic), symbols and
  emoji with `Intl.Segmenter` graphemes, preserving combining marks and ZWJ
  sequences. For joining/complex scripts and bidi text, let the browser shape
  the complete logical paragraph with `dir=auto`, then place narrow bitmap
  slices along the curve in visual order. This preserves browser bidi ordering,
  Latin words, numbers and contextual joins without reversing text. The atlas
  ripple also bends shaped ink without changing logical text or shaping.
  Connected strips share secant endpoints and a constant height per row;
  independent graphemes retain smoothly varying affine placement on top of
  their already curved ink.
  Straight text retains its full-line browser renderer.
- Use at most two temporary canvases, each at most 2 million pixels and 8192
  pixels per side. Pack both row sizes in one original atlas, and bend it into
  the other using integer horizontal scanlines: these partition y without
  overlapping or leaving cracks. Repeated glyphs use transformed `drawImage`,
  avoiding transformed `fillText` per occurrence. Sampling is up to 3× the output
  font size; unusually long text reduces resolution to stay within the bound.
- For connected paragraphs, reuse the released original atlas as one bounded
  row scratch canvas. Add premultiplied strip-edge coverage within that one row,
  then rotate/composite the finished row at its opacity using normal source-over.
  No overlapping source crops or interior ink duplication are introduced; only
  the first/last paragraph crops contain ink overshoots. This avoids both dark
  overlap seams and light cracks from separately rotated strip edges. The
  scratch uses a fixed pattern origin, so Position remains a rigid translation.
  Large rows reduce its sampling resolution to meet the same bound. This extra
  resampling can soften connected text and costs more than independent glyphs;
  it is not a collection of full-resolution row canvases. All temporary canvases
  are released after rendering, including on failure. Typography still varies
  with platform fonts. A Chromium solid-join probe at 48% opacity and 0°, −32°,
  60° rotation varied by at most one alpha level (121–122), versus 106–122 for
  separately rotated strips; this is not a pixel-identical vector renderer.
- The editor owns one transparent watermark layer, at most 16 million pixels
  (64 MB of RGBA storage). Redaction and selection interactions reuse it. Image
  changes, font readiness, dimensions, text and every rendering setting invalidate
  it; grayscale and redaction changes only recompose the image. Larger inputs
  render directly without retaining a full-size layer. Replacing/removing the
  document or unmounting its owner releases the layer. There is no permanent global bitmap cache.
- Position translates a fixed seeded walk, preserving the letters' positions in
  pattern coordinates. Preview paints are coalesced with animation frames;
  exports use the settings committed when Download or Copy is pressed.
- Draw opaque redactions before the watermark, then encode a fresh canvas as
  PNG. Export reuses a current watermark layer, waits for font readiness and
  explicitly uses watermarked mode regardless of comparison state. Its temporary
  output canvas is released after encoding.
  No original image or editable overlay is attached to the output.

Google's [visible-watermark research](https://www.research.google/blog/making-visible-watermarks-more-effective/)
found geometric perturbations more effective against its collection-based
attack than changing position or opacity alone. This supports varying the
geometry, but does not demonstrate resistance to current AI removal tools.
[Guilloché and microtext in physical security printing](https://pwpw.eu/en/Competencies/Security_features.html)
inspired the appearance; their physical anti-copy benefits do not automatically
apply to raster overlays.

## Validation and limits

Golden and behavior tests check deterministic pixels, seed variation, bounded
glyph deformation, independent controls, grapheme/paragraph preservation,
offset rigidity, operation budgets, cache reuse/invalidation, redaction
independence from hidden content and the untouched comparison path. They do not
measure adversarial removal resistance. Browser QA should cover the sample,
all four strengths, Straight text, adjustments, redactions and repeated exports.

Before making stronger security claims, compare each preset using synthetic
documents and authorized test material:

- Resize and JPEG recompression at realistic sharing resolutions.
- Grayscale, thresholding, blur, median filtering and sharpening.
- Crops containing useful identity fields, not only full-page outputs.
- AI inpainting / watermark removal, checking exact field transcription and
  local damage as well as remaining watermark visibility.
- Human readability and OCR on the marked input, including dark backgrounds,
  low-resolution photos, long recipients and non-Latin text.

Measure retained markings and document usability separately. Broad image-quality
scores alone can conceal an altered digit or damaged face. Do not use real
identity documents with external removal services. No AI-removal benchmark has
been completed for this renderer. PDF handling is outside this implementation.
