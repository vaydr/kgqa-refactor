import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWABLE_RELATIONSHIPS,
  bridgeEdgesPrompt,
  generateClausesPrompt,
  generateGraphPrompt,
} from "@/lib/ai/kgqa/prompts";

const WIKIPEDIA_TITLE_REGEX = /Wikipedia article title/i;
const VERB_LED_NODE_REGEX = /verb\s*\+\s*noun|imperative|action phrase/i;
const IMPROVE_X_REGEX = /improve X/i;

test("KGQA prompts require article-title-style node names", () => {
  for (const prompt of [
    generateClausesPrompt,
    generateGraphPrompt,
    bridgeEdgesPrompt,
  ]) {
    assert.match(
      prompt,
      WIKIPEDIA_TITLE_REGEX,
      "prompt should require node names that resemble article titles"
    );
  }
});

test("KGQA prompts forbid verb-led node phrases", () => {
  for (const prompt of [
    generateClausesPrompt,
    generateGraphPrompt,
    bridgeEdgesPrompt,
  ]) {
    assert.match(
      prompt,
      VERB_LED_NODE_REGEX,
      "prompt should explicitly ban verb-led pseudo-entities"
    );
    assert.match(
      prompt,
      IMPROVE_X_REGEX,
      "prompt should include a concrete bad-node example like 'improve X'"
    );
  }
});

test("KGQA relationship allowlist includes the newly approved edges", () => {
  for (const relationship of [
    "coined_by",
    "moved",
    "moves",
    "defined",
    "defines",
  ]) {
    assert.ok(
      ALLOWABLE_RELATIONSHIPS.includes(relationship),
      `expected ${relationship} to be in ALLOWABLE_RELATIONSHIPS`
    );
  }
});
