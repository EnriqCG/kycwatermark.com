import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeWatermarkText,
  edgeCursor,
  findEdgeZone,
  findMatchingPreset,
  formatWatermarkDate,
  getDownloadFileName,
  getEffectiveWatermarkSpacing,
  getImageFileValidationError,
  getScaleFactor,
  MAX_FILE_SIZE_BYTES,
  pointInRect,
  pointOnDeleteHandle,
  pointOnRotationHandle,
  type RedactionRect,
  resizeRect,
  scaleWatermarkSettings,
  screenToCanvas,
  toLocal,
  type WatermarkSettings,
  wrapWatermarkText,
} from "./imageLogic.ts";

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.strictEqual(actual, expected);
    },
    toBeCloseTo(expected: number) {
      assert.ok(
        typeof actual === "number" && Math.abs(actual - expected) < 1e-10,
        `expected ${String(actual)} to be close to ${expected}`,
      );
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
  };
}

const settings: WatermarkSettings = {
  text: "Only for verification",
  angle: -32,
  opacity: 0.4,
  fontSize: 34,
  spacingX: 520,
  spacingY: 180,
  color: "#353B46",
  grayscale: true,
  offsetX: -10,
  offsetY: 15,
  lineGap: 12,
  stagger: 25,
};

describe("watermark sizing and layout", () => {
  it("uses the image diagonal relative to the 1000px reference", () => {
    expect(getScaleFactor(600, 800)).toBe(1);
    expect(getScaleFactor(300, 400)).toBe(0.5);
    expect(getScaleFactor(1200, 1600)).toBe(2);
  });

  it("scales all spatial settings and leaves source settings untouched", () => {
    expect(scaleWatermarkSettings(settings, 0.5)).toEqual({
      fontSize: 17,
      spacingX: 260,
      spacingY: 90,
      lineGap: 6,
      offsetX: -5,
      offsetY: 7.5,
      stagger: 12.5,
    });
    expect(settings.fontSize).toBe(34);
  });

  it("normalizes whitespace and wraps between words", () => {
    const result = wrapWatermarkText(
      "  Only   for verification  ",
      90,
      (text) => text.length * 10,
    );
    expect(result).toEqual({
      lines: ["Only for", "verification"],
      textWidth: 120,
    });
  });

  it("keeps a word that is wider than the available line intact", () => {
    expect(
      wrapWatermarkText("verification", 20, (text) => text.length),
    ).toEqual({
      lines: ["verification"],
      textWidth: 12,
    });
  });

  it("returns no layout for whitespace-only watermark text", () => {
    expect(wrapWatermarkText(" \n ", 100, () => 10)).toEqual({
      lines: [],
      textWidth: 0,
    });
  });

  it("expands spacing to prevent wrapped text overlap", () => {
    expect(
      getEffectiveWatermarkSpacing(["one", "two"], 130, 20, 100, 30, 5),
    ).toEqual({
      verticalSpan: 50,
      spacingX: 142,
      spacingY: 62,
    });
  });

  it("preserves configured spacing when it is already sufficient", () => {
    expect(getEffectiveWatermarkSpacing(["one"], 30, 20, 100, 80, 5)).toEqual({
      verticalSpan: 25,
      spacingX: 100,
      spacingY: 80,
    });
  });

  it("uses one font-size span when there are no lines", () => {
    expect(getEffectiveWatermarkSpacing([], 0, 20, 40, 10, 5)).toEqual({
      verticalSpan: 20,
      spacingX: 40,
      spacingY: 32,
    });
  });
});

describe("file behavior", () => {
  for (const [input, expected] of [
    ["passport.jpg", "passport-kyc-watermarked.png"],
    ["scan.final.webp", "scan.final-kyc-watermarked.png"],
    ["passport", "passport-kyc-watermarked.png"],
    [".passport", ".passport-kyc-watermarked.png"],
  ] as const) {
    it(`derives a download name from ${input}`, () => {
      expect(getDownloadFileName(input, "watermarked-id.png")).toBe(expected);
    });
  }

  it("uses the preset name before a file is loaded", () => {
    expect(getDownloadFileName("", "watermarked-id.png")).toBe(
      "watermarked-id.png",
    );
  });

  for (const [recipient, expected] of [
    ["Acme Bank", "passport-for-acme-bank.png"],
    ["  Société Générale! ", "passport-for-societe-generale.png"],
    ["!!!", "passport-kyc-watermarked.png"],
  ] as const) {
    it(`adds the recipient "${recipient}" to the download name`, () => {
      expect(
        getDownloadFileName("passport.jpg", "watermarked-id.png", recipient),
      ).toBe(expected);
    });
  }

  it("accepts image MIME types at exactly the size limit", () => {
    expect(
      getImageFileValidationError({
        type: "image/png",
        size: MAX_FILE_SIZE_BYTES,
      }),
    ).toBeNull();
  });

  it("rejects non-image MIME types before considering size", () => {
    expect(
      getImageFileValidationError({
        type: "application/pdf",
        size: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toBe("Please drop a valid image file (PNG, JPG, WebP, HEIC).");
  });

  it("rejects image files over 20MB", () => {
    expect(
      getImageFileValidationError({
        type: "image/jpeg",
        size: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toBe("Image is too large. Keep files under 20MB.");
  });
});

describe("screen and canvas coordinates", () => {
  it("accounts for vertical letterboxing", () => {
    expect(
      screenToCanvas(
        { x: 110, y: 120 },
        { width: 400, height: 200 },
        { left: 10, top: 20, width: 200, height: 200 },
      ),
    ).toEqual({ x: 200, y: 100 });
  });

  it("accounts for horizontal letterboxing", () => {
    expect(
      screenToCanvas(
        { x: 110, y: 70 },
        { width: 200, height: 400 },
        { left: 10, top: 20, width: 200, height: 100 },
      ),
    ).toEqual({ x: 100, y: 200 });
  });

  it("does not clamp pointer positions in the letterbox", () => {
    expect(
      screenToCanvas(
        { x: 110, y: 45 },
        { width: 400, height: 200 },
        { left: 10, top: 20, width: 200, height: 200 },
      ).y,
    ).toBe(-50);
  });
});

describe("redaction hit testing", () => {
  const rect: RedactionRect = { x: 10, y: 20, w: 100, h: 40, angle: 0 };

  it("converts world coordinates into a rotated rectangle's local space", () => {
    const rotated = { ...rect, angle: Math.PI / 2 };
    expect(toLocal(60, 90, rotated).lx).toBeCloseTo(50);
    expect(toLocal(60, 90, rotated).ly).toBeCloseTo(0);
  });

  it("includes boundaries and excludes points outside a rotated rectangle", () => {
    const rotated = { ...rect, angle: Math.PI / 2 };
    expect(pointInRect(60, 90, rotated)).toBe(true);
    expect(pointInRect(60, 91, rotated)).toBe(false);
    expect(pointInRect(39, 40, rotated)).toBe(false);
  });

  it("finds rotation and delete handles at scale", () => {
    expect(pointOnRotationHandle(60, 0, rect, 1)).toBe(true);
    expect(pointOnRotationHandle(72, 0, rect, 1)).toBe(true);
    expect(pointOnRotationHandle(72.1, 0, rect, 1)).toBe(false);
    expect(pointOnDeleteHandle(60, 80, rect, 1)).toBe(true);
  });

  it("rotates handle hit areas with the rectangle", () => {
    const rotated = { ...rect, angle: Math.PI / 2 };
    expect(pointOnRotationHandle(100, 40, rotated, 1)).toBe(true);
    expect(pointOnDeleteHandle(20, 40, rotated, 1)).toBe(true);
  });

  for (const [x, y, edge] of [
    [60, 20, "top"],
    [60, 60, "bottom"],
    [10, 40, "left"],
    [110, 40, "right"],
  ] as const) {
    it(`identifies the ${edge} edge at (${x}, ${y})`, () => {
      expect(findEdgeZone(x, y, rect, 1)).toBe(edge);
    });
  }

  it("does not identify the interior or distant points as edges", () => {
    expect(findEdgeZone(60, 40, rect, 1)).toBeNull();
    expect(findEdgeZone(200, 40, rect, 1)).toBeNull();
  });

  it("maps edge direction and rotation to the current CSS cursors", () => {
    expect(edgeCursor("left", 0)).toBe("ew-resize");
    expect(edgeCursor("top", 0)).toBe("ns-resize");
    expect(edgeCursor("right", Math.PI / 4)).toBe("nwse-resize");
    expect(edgeCursor("bottom", Math.PI / 4)).toBe("nesw-resize");
  });
});

describe("redaction resizing", () => {
  const rect: RedactionRect = { x: 10, y: 20, w: 100, h: 40, angle: 0 };

  for (const [edge, point, expected] of [
    ["right", { x: 130, y: 40 }, { x: 10, y: 20, w: 120, h: 40 }],
    ["left", { x: 30, y: 40 }, { x: 30, y: 20, w: 80, h: 40 }],
    ["bottom", { x: 60, y: 70 }, { x: 10, y: 20, w: 100, h: 50 }],
    ["top", { x: 60, y: 30 }, { x: 10, y: 30, w: 100, h: 30 }],
  ] as const) {
    it(`moves only the ${edge} edge`, () => {
      expect(resizeRect(rect, point, edge)).toEqual({
        ...expected,
        angle: 0,
      });
    });
  }

  it("enforces the existing six-pixel minimum size", () => {
    expect(resizeRect(rect, { x: -100, y: 40 }, "right")).toEqual({
      x: 10,
      y: 20,
      w: 6,
      h: 40,
      angle: 0,
    });
  });

  it("moves a rotated edge along the rectangle's local axis", () => {
    const rotated = { ...rect, angle: Math.PI / 2 };
    const result = resizeRect(rotated, { x: 60, y: 110 }, "right");
    expect(result.w).toBeCloseTo(120);
    expect(result.h).toBe(40);
    expect(result.x + result.w / 2).toBeCloseTo(60);
    expect(result.y + result.h / 2).toBeCloseTo(50);
    expect(result.angle).toBe(Math.PI / 2);
  });
});

describe("watermark text and strength", () => {
  it("composes the watermark from purpose, recipient, and date", () => {
    expect(
      composeWatermarkText(
        "identity verification",
        " Acme Bank ",
        "3 Nov 2026",
      ),
    ).toBe("Only for identity verification at Acme Bank · 3 Nov 2026");
  });

  it("uses a placeholder recipient and omits a missing date", () => {
    expect(composeWatermarkText("account opening", "   ")).toBe(
      "Only for account opening at [Company]",
    );
  });

  it("formats the watermark date as day, short month, and year", () => {
    expect(formatWatermarkDate(new Date(2026, 10, 3), "en-GB")).toBe(
      "3 Nov 2026",
    );
  });

  const presets = [
    {
      id: "subtle",
      values: { opacity: 0.22, fontSize: 30, spacingX: 560, spacingY: 220 },
    },
    {
      id: "balanced",
      values: { opacity: 0.4, fontSize: 34, spacingX: 520, spacingY: 180 },
    },
  ];

  it("finds the preset whose values all match the settings", () => {
    expect(findMatchingPreset(settings, presets)?.id).toBe("balanced");
  });

  it("returns null once any preset value is changed", () => {
    expect(
      findMatchingPreset({ ...settings, fontSize: 35 }, presets),
    ).toBeNull();
  });
});
