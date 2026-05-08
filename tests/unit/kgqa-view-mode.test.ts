import assert from "node:assert/strict";
import test from "node:test";
import {
  getKGQAViewPresentation,
  KGQA_VIEW_MODES,
  parseKGQAViewModeParam,
} from "@/components/kgqa-view-mode";

test("KGQA view modes expose the expected selector options", () => {
  assert.deepEqual(KGQA_VIEW_MODES, ["both", "answer-only"]);
});

test("KGQA view presentation blurs the correct region", () => {
  assert.deepEqual(getKGQAViewPresentation("both"), {
    blurAssistant: false,
    blurGraph: false,
    blurAnswer: false,
  });
  assert.deepEqual(getKGQAViewPresentation("answer-only"), {
    blurAssistant: false,
    blurGraph: true,
    blurAnswer: false,
  });
});

test("parseKGQAViewModeParam maps URL values to modes", () => {
  assert.equal(parseKGQAViewModeParam("ans"), "answer-only");
  assert.equal(parseKGQAViewModeParam("both"), "both");
  assert.equal(parseKGQAViewModeParam(null), "both");
  assert.equal(parseKGQAViewModeParam("garbage"), "both");
});
