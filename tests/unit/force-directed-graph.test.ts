import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGraphLayoutState,
  getGraphLayoutSignature,
} from "@/components/force-directed-graph";

const triples = [
  {
    node1: "Heart",
    relationship: "pumps",
    node2: "Blood",
    score: 0.9,
  },
  {
    node1: "Blood",
    relationship: "flows_to",
    node2: "Lungs",
    score: 0.8,
  },
];

const clauseNodes = new Set(["Heart", "Lungs"]);
const reasoningEdgesMap = new Map([
  ["Heart|pumps|Blood", { flipped: false }],
  ["Blood|flows_to|Lungs", { flipped: false }],
]);

test("graph layout signature is stable for the same triples", () => {
  const ordered = getGraphLayoutSignature({
    triples,
    clauseNodes,
    clauses: [
      { node1: "Heart", relationship: "pumps", node2: "Blood" },
      { node1: "Blood", relationship: "flows_to", node2: "Lungs" },
    ],
  });

  const reordered = getGraphLayoutSignature({
    triples: [triples[1], triples[0]],
    clauseNodes: new Set(["Lungs", "Heart"]),
    clauses: [
      { node1: "Blood", relationship: "flows_to", node2: "Lungs" },
      { node1: "Heart", relationship: "pumps", node2: "Blood" },
    ],
  });

  assert.equal(ordered, reordered);
});

test("graph layout preserves existing node positions across resize-driven rebuilds", () => {
  const initial = buildGraphLayoutState({
    triples,
    clauseNodes,
    reasoningEdgesMap,
    width: 1200,
    height: 700,
  });

  const resized = buildGraphLayoutState({
    triples,
    clauseNodes,
    reasoningEdgesMap,
    width: 900,
    height: 420,
    previousNodes: initial.nodes,
  });

  assert.deepEqual(
    resized.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    })),
    initial.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    }))
  );
});

test("graph layout seeds deterministic positions for a fresh graph", () => {
  const first = buildGraphLayoutState({
    triples,
    clauseNodes,
    reasoningEdgesMap,
    width: 1200,
    height: 700,
  });

  const second = buildGraphLayoutState({
    triples,
    clauseNodes,
    reasoningEdgesMap,
    width: 1200,
    height: 700,
  });

  assert.deepEqual(
    first.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    })),
    second.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    }))
  );
});
