import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudyQuestionDetectorPrompt,
  resolveStudyQuestionRoute,
  studyQuestionDetectionOutputSchema,
} from "@/lib/ai/kgqa/detect-study-question";
import { STUDY_QUESTION_FIXTURES } from "@/lib/ai/kgqa/study-fixtures";

test("study detector prompt includes every canonical study question", () => {
  const prompt = buildStudyQuestionDetectorPrompt(STUDY_QUESTION_FIXTURES);

  for (const fixture of Object.values(STUDY_QUESTION_FIXTURES)) {
    assert.match(prompt, new RegExp(fixture.id));
    assert.match(prompt, new RegExp(fixture.canonicalQuestion));
  }
});

test("study detector schema accepts study matches and explicit non-matches", () => {
  assert.deepEqual(
    studyQuestionDetectionOutputSchema.parse({
      isStudyQuestion: true,
      studyQuestionId: "djorkaeff-inter-fulham",
    }),
    {
      isStudyQuestion: true,
      studyQuestionId: "djorkaeff-inter-fulham",
    }
  );

  assert.deepEqual(
    studyQuestionDetectionOutputSchema.parse({
      isStudyQuestion: false,
      studyQuestionId: null,
    }),
    {
      isStudyQuestion: false,
      studyQuestionId: null,
    }
  );
});

test("study route resolution diverts matched questions and preserves normal flow otherwise", () => {
  assert.equal(
    resolveStudyQuestionRoute({
      hasSelection: true,
      studyDetection: {
        isStudyQuestion: true,
        studyQuestionId: "djorkaeff-inter-fulham",
      },
    }),
    "study"
  );

  assert.equal(
    resolveStudyQuestionRoute({
      hasSelection: false,
      studyDetection: {
        isStudyQuestion: false,
        studyQuestionId: null,
      },
    }),
    "kgqa"
  );

  assert.equal(
    resolveStudyQuestionRoute({
      hasSelection: true,
      studyDetection: {
        isStudyQuestion: false,
        studyQuestionId: null,
      },
    }),
    "classifier"
  );
});
