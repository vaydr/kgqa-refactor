import assert from "node:assert/strict";
import test from "node:test";
import { isGraphConnected, isPathConnected } from "@/lib/ai/kgqa/connectivity";
import { ALLOWABLE_RELATIONSHIPS } from "@/lib/ai/kgqa/prompts";
import {
  STUDY_QUESTION_FIXTURES,
  STUDY_QUESTION_IDS,
  sampleStudyQuestions,
} from "@/lib/ai/kgqa/study-fixtures";

const FORBIDDEN_FIXTURE_NODES = new Set([
  "North polar region of Titan",
  "Caucasus region",
  "Museum studies",
]);

test("study fixtures expose the twenty-four planned question ids", () => {
  assert.equal(STUDY_QUESTION_IDS.length, 24);
  assert.deepEqual(STUDY_QUESTION_IDS, [
    "djorkaeff-inter-fulham",
    "olajuwon-mvp-drexler",
    "theodore-hart-therrien",
    "kubica-gp-theissen",
    "bossy-rookie-selanne",
    "barrichello-wdc-brackley",
    "boli-marseille-goethals",
    "horry-mvp-tomjanovich",
    "savicevic-milan-baresi",
    "kubica-bmw-reithofer",
    "rivera-yankees-brooklyn",
    "hamilton-mercedes-vienna",
    "tortorella-tampa-iginla",
    "olajuwon-draft-williams",
    "brady-patriots-nashville",
    "erving-sixers-brooklyn",
    "giguere-ducks-oilers",
    "billups-pistons-united-states",
    "bryant-lakers-celtics-massachusetts",
    "messi-barca-khaldoon-abu-dhabi",
    "kalou-chelsea-toennies-group",
    "barrichello-brawn-zetsche-daimler",
    "curry-warriors-popovich-east-chicago",
    "cannavaro-juventus-perez-madrid",
  ]);
});

test("study fixtures include connected graphs and connected answer paths", () => {
  for (const fixture of Object.values(STUDY_QUESTION_FIXTURES)) {
    assert.ok(
      fixture.graph.triples.length >= 25 && fixture.graph.triples.length <= 40,
      `expected ${fixture.id} to have 25-40 graph edges`
    );
    assert.ok(
      isGraphConnected(fixture.graph.triples),
      `expected ${fixture.id} graph to be connected`
    );
    assert.ok(
      isPathConnected(fixture.clauses.clauses),
      `expected ${fixture.id} clauses to form a connected path`
    );

    const uniqueNodes = new Set(
      fixture.graph.triples.flatMap((triple) => [triple.node1, triple.node2])
    );

    assert.ok(
      uniqueNodes.size >= 15 && uniqueNodes.size <= 30,
      `expected ${fixture.id} to have 15-30 unique nodes`
    );

    const answerNodeDegree = fixture.graph.triples.filter(
      (triple) =>
        triple.node1 === fixture.expectedAnswer ||
        triple.node2 === fixture.expectedAnswer
    ).length;

    assert.ok(
      answerNodeDegree >= 4,
      `expected ${fixture.id} answer node to be near the graph center`
    );

    const graphEdges = new Set(
      fixture.graph.triples.map(
        (triple) => `${triple.node1}|${triple.relationship}|${triple.node2}`
      )
    );

    if (fixture.isCorrect) {
      for (const clause of fixture.clauses.clauses) {
        assert.ok(
          graphEdges.has(
            `${clause.node1}|${clause.relationship}|${clause.node2}`
          ),
          `expected ${fixture.id} clause edge to exist in the graph`
        );
      }
    } else {
      const mismatchCount = fixture.clauses.clauses.filter(
        (clause) =>
          !graphEdges.has(
            `${clause.node1}|${clause.relationship}|${clause.node2}`
          )
      ).length;
      assert.ok(
        mismatchCount >= 1,
        `expected ${fixture.id} (isCorrect=false) to have at least one clause edge missing from the graph`
      );
    }

    for (const triple of fixture.graph.triples) {
      assert.ok(
        ALLOWABLE_RELATIONSHIPS.includes(triple.relationship),
        `expected ${fixture.id} relationship ${triple.relationship} to be allowed`
      );
    }

    const isInCount = fixture.graph.triples.filter(
      (triple) => triple.relationship === "is_in"
    ).length;

    assert.ok(
      isInCount <= 6,
      `expected ${fixture.id} to avoid overusing is_in edges`
    );

    for (const node of uniqueNodes) {
      assert.ok(
        !FORBIDDEN_FIXTURE_NODES.has(node),
        `expected ${fixture.id} node ${node} to be replaced with a more article-like title`
      );
    }

    const relationships = new Set(
      fixture.graph.triples.map((triple) => triple.relationship)
    );

    assert.ok(
      relationships.size >= 10,
      `expected ${fixture.id} to use at least ten distinct relationship types`
    );
  }
});

test("study fixtures span the planned path lengths", () => {
  const hopCounts = STUDY_QUESTION_IDS.map(
    (id) => STUDY_QUESTION_FIXTURES[id].hopCount
  );

  assert.deepEqual(
    hopCounts,
    [3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6]
  );
});

test("study fixtures have valid hopCount and isCorrect fields", () => {
  const validHops = new Set([3, 4, 6]);
  for (const fixture of Object.values(STUDY_QUESTION_FIXTURES)) {
    assert.ok(
      validHops.has(fixture.hopCount),
      `expected ${fixture.id} hopCount to be 3, 4, or 6`
    );
    assert.ok(
      typeof fixture.isCorrect === "boolean",
      `expected ${fixture.id} isCorrect to be a boolean`
    );
  }
});

test("sampleStudyQuestions returns 12 unique fixtures from the 24", () => {
  const sample = sampleStudyQuestions();
  assert.equal(sample.length, 12);

  const ids = new Set(sample.map((f) => f.id));
  assert.equal(ids.size, 12, "expected sampled fixtures to be unique");

  for (const fixture of sample) {
    assert.ok(
      STUDY_QUESTION_IDS.includes(fixture.id),
      `expected ${fixture.id} to be a known study fixture`
    );
  }
});

test("study fixtures expose stable two-digit study numbers", () => {
  for (let i = 0; i < STUDY_QUESTION_IDS.length; i++) {
    const id = STUDY_QUESTION_IDS[i];
    const expected = String(i + 1).padStart(2, "0");
    assert.equal(STUDY_QUESTION_FIXTURES[id].studyNumber, expected);
  }
});
