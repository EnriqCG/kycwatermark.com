/// <reference lib="es2022.intl" />

/** Keep grapheme clusters intact. Complex text is shaped as one browser bidi
 * paragraph, then sampled in visual (bitmap) order along the curve. In particular,
 * neither words nor code points are reversed to approximate the bidi algorithm. */
export function segmentWovenText(text: string): {
  text: string;
  shaped: boolean;
  tokens: string[];
} {
  const paragraph = `${text.replace(/[\r\n\t]+/g, " ")} · `;
  // These scripts have independent glyphs. Everything else with letters/marks
  // uses browser paragraph shaping (Arabic, Indic, Thai, etc.). Bidi controls also
  // require whole-paragraph layout, even in otherwise Latin text.
  const independent =
    /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Common}\p{Script=Inherited}]*$/u;
  const shaped =
    !independent.test(paragraph) ||
    /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(paragraph);
  const tokens = shaped
    ? [paragraph]
    : Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          paragraph,
        ),
        ({ segment }) => segment,
      );
  return { text: paragraph, shaped, tokens };
}

/** Let the browser resolve dir=auto using the Unicode first-strong rule. The
 * same browser then performs bidi layout, joining and numeric ordering in canvas. */
export function browserTextDirection(text: string): CanvasDirection {
  const probe = document.createElement("span");
  probe.dir = "auto";
  probe.textContent = text;
  probe.style.display = "none";
  document.body.append(probe);
  const direction = getComputedStyle(probe).direction === "rtl" ? "rtl" : "ltr";
  probe.remove();
  return direction;
}
