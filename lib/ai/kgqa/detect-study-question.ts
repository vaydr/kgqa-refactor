import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { z } from "zod";
import {
  STUDY_QUESTION_FIXTURES,
  STUDY_QUESTION_IDS,
  type StudyQuestionId,
} from "./study-fixtures";

const STUDY_DETECTOR_MODEL = "openai/gpt-4.1-mini";

export const studyQuestionIdSchema = z.enum(STUDY_QUESTION_IDS);

export const studyQuestionDetectionOutputSchema = z
  .object({
    isStudyQuestion: z.boolean(),
    studyQuestionId: studyQuestionIdSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.isStudyQuestion && value.studyQuestionId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studyQuestionId is required when isStudyQuestion is true",
        path: ["studyQuestionId"],
      });
    }

    if (!value.isStudyQuestion && value.studyQuestionId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studyQuestionId must be null when isStudyQuestion is false",
        path: ["studyQuestionId"],
      });
    }
  });

export type StudyQuestionDetectionOutput = z.infer<
  typeof studyQuestionDetectionOutputSchema
>;

type StudyQuestionDetectorPromptInput = Record<
  StudyQuestionId,
  {
    canonicalQuestion: string;
  }
>;

type StudyQuestionRoute = "study" | "kgqa" | "classifier";

export function buildStudyQuestionDetectorPrompt(
  fixtures: StudyQuestionDetectorPromptInput
) {
  const questionDefinitions = STUDY_QUESTION_IDS.map((id) => {
    const fixture = fixtures[id];

    return `- ${id}: ${fixture.canonicalQuestion}`;
  }).join("\n");

  return `You are a study-question detector for a hidden internal workflow.

Determine whether the user's question is asking for one of the exact study intents below, allowing for normal paraphrases, reordered wording, or minor wording changes.

If the user is not clearly asking one of these study questions, return isStudyQuestion=false and studyQuestionId=null.
Do not guess. Prefer false/null when uncertain.

Study questions:
${questionDefinitions}`;
}

export async function detectStudyQuestion({
  question,
}: {
  question: string;
}): Promise<StudyQuestionDetectionOutput> {
  try {
    const result = await generateObject({
      model: gateway.languageModel(STUDY_DETECTOR_MODEL),
      system: buildStudyQuestionDetectorPrompt(STUDY_QUESTION_FIXTURES),
      prompt: question,
      schema: studyQuestionDetectionOutputSchema,
    });

    return result.object;
  } catch {
    return {
      isStudyQuestion: false,
      studyQuestionId: null,
    };
  }
}

export function resolveStudyQuestionRoute({
  hasSelection,
  studyDetection,
}: {
  hasSelection: boolean;
  studyDetection: StudyQuestionDetectionOutput;
}): StudyQuestionRoute {
  if (
    studyDetection.isStudyQuestion &&
    studyDetection.studyQuestionId !== null
  ) {
    return "study";
  }

  return hasSelection ? "classifier" : "kgqa";
}
