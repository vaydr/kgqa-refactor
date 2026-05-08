import { z } from "zod";

export const clauseSchema = z.object({
  node1: z.string().min(2).describe("Subject entity — must be a proper noun or named concept"),
  relationship: z.string().describe("Predicate/relationship"),
  node2: z.string().min(2).describe("Object entity — must be a proper noun or named concept"),
});

export const clausesOutputSchema = z.object({
  clauses: z
    .array(clauseSchema)
    .min(1)
    .describe("Reasoning path as knowledge graph triples"),
});

export const graphTripleSchema = z.object({
  score: z.number().describe("Confidence score 0-1"),
  node1: z.string().min(2).describe("Subject entity — must be a proper noun or named concept"),
  relationship: z.string().describe("Predicate/relationship"),
  node2: z.string().min(2).describe("Object entity — must be a proper noun or named concept"),
});

export const graphOutputSchema = z.object({
  triples: z
    .array(graphTripleSchema)
    .min(10)
    .describe("Connected knowledge graph triples, aim for 25"),
});

export const answerOutputSchema = z.object({
  answer: z.string().describe("Final answer to the question"),
  reasoning: z
    .string()
    .optional()
    .describe("Explanation of how the answer was derived from the graph"),
});

export const classifierOutputSchema = z.object({
  category: z
    .enum(["Contained", "Uncontained"])
    .describe(
      "Whether the question relates to the user selection (Contained) or not (Uncontained)"
    ),
});

export const directAnswerOutputSchema = z.object({
  answer: z.string().describe("Direct answer to the unrelated question"),
  reasoning: z.string().optional().describe("Brief explanation of the answer"),
});

export const bridgeEdgesOutputSchema = z.object({
  triples: z
    .array(graphTripleSchema)
    .min(1)
    .describe("Bridging triples to connect disconnected graph components"),
});

export type BridgeEdgesOutput = z.infer<typeof bridgeEdgesOutputSchema>;

export type Clause = z.infer<typeof clauseSchema>;
export type ClausesOutput = z.infer<typeof clausesOutputSchema>;
export type GraphTriple = z.infer<typeof graphTripleSchema>;
export type GraphOutput = z.infer<typeof graphOutputSchema>;
export type AnswerOutput = z.infer<typeof answerOutputSchema>;
export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;
export type DirectAnswerOutput = z.infer<typeof directAnswerOutputSchema>;
