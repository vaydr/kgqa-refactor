import type { UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";
import { STUDY_REASONING } from "./study-reasoning";
import {
  STUDY_QUESTION_FIXTURES,
  STUDY_QUESTION_IDS,
  type StudyQuestionFixture,
  type StudyQuestionId,
} from "./study-fixtures";

const STUDY_DETECTOR_LOOKUP: Record<string, StudyQuestionId> = (() => {
  const map: Record<string, StudyQuestionId> = {};
  for (const id of STUDY_QUESTION_IDS) {
    const key = STUDY_QUESTION_FIXTURES[id].canonicalQuestion
      .trim()
      .toLowerCase();
    map[key] = id;
  }
  return map;
})();

export function detectStudyQuestionExact(
  question: string
): StudyQuestionId | null {
  const key = question.trim().toLowerCase();
  return STUDY_DETECTOR_LOOKUP[key] ?? null;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const STUDY_CLAUSE_DELAY_MS = 300;
const STUDY_ANSWER_WORD_DELAY_MS = 25;

export function buildStudyReasoning(fixture: StudyQuestionFixture): string {
  const text = STUDY_REASONING[fixture.id];
  if (text && text.trim().length > 0) {
    return text;
  }
  if (fixture.reasoning && fixture.reasoning.trim().length > 0) {
    return fixture.reasoning;
  }

  return fixture.isCorrect
    ? `Based on what's commonly known about the subjects in the question, the answer is ${fixture.expectedAnswer}.`
    : `The connection here isn't fully clear, but a plausible answer is ${fixture.expectedAnswer}.`;
}

export async function streamStudyClauses({
  dataStream,
  fixture,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  fixture: StudyQuestionFixture;
}) {
  const accumulated: typeof fixture.clauses.clauses = [];
  for (const clause of fixture.clauses.clauses) {
    accumulated.push(clause);
    dataStream.write({
      type: "data-kgqa-clauses",
      data: { clauses: [...accumulated] },
    });
    await wait(STUDY_CLAUSE_DELAY_MS);
  }
  dataStream.write({
    type: "data-kgqa-clauses",
    data: fixture.clauses,
  });
}

export async function streamStudyAnswer({
  dataStream,
  fixture,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  fixture: StudyQuestionFixture;
}) {
  dataStream.write({ type: "data-kgqa-step", data: "answer" });

  const reasoning = buildStudyReasoning(fixture);
  const tokens = reasoning.split(/(\s+)/);
  let accumulated = "";

  for (const token of tokens) {
    accumulated += token;
    dataStream.write({
      type: "data-kgqa-answer",
      data: {
        answer: fixture.expectedAnswer,
        reasoning: accumulated,
      },
    });
    if (token.trim().length > 0) {
      await wait(STUDY_ANSWER_WORD_DELAY_MS);
    }
  }

  dataStream.write({
    type: "data-kgqa-answer",
    data: {
      answer: fixture.expectedAnswer,
      reasoning,
    },
  });

  dataStream.write({ type: "data-kgqa-step", data: "complete" });

  return {
    answer: fixture.expectedAnswer,
    reasoning,
  };
}
