import type { UIMessage } from "ai";
import { z } from "zod";
import type {
  AnswerOutput,
  ClassifierOutput,
  ClausesOutput,
  DirectAnswerOutput,
  GraphOutput,
} from "./ai/kgqa/schemas";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = Record<string, never>;

export type KGQAStep =
  | "classify"
  | "clauses"
  | "graph"
  | "answer"
  | "complete"
  | "error";

export type CustomUIDataTypes = {
  appendMessage: string;
  "chat-title": string;
  "kgqa-step": KGQAStep;
  "kgqa-classify": ClassifierOutput;
  "kgqa-clauses": ClausesOutput;
  "kgqa-graph": GraphOutput;
  "kgqa-answer": Partial<AnswerOutput>;
  "kgqa-direct-answer": Partial<DirectAnswerOutput>;
  "kgqa-error": string;
  "kgqa-incorrect": boolean;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
