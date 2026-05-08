import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CHAT_PANEL_SIZE,
  DEFAULT_DATA_PANEL_SIZE,
} from "@/components/chat-layout";

test("desktop left workspace starts with the scatterplot collapsed", () => {
  assert.equal(DEFAULT_DATA_PANEL_SIZE, 0);
  assert.equal(DEFAULT_CHAT_PANEL_SIZE, 100);
});
