import { gateway } from "@ai-sdk/gateway";
import { generateObject, streamObject, type UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";
import {
  buildBridgePrompt,
  findConnectedComponents,
  isGraphConnected,
  isPathConnected,
} from "./connectivity";
import {
  answerWithGraphPrompt,
  bridgeEdgesPrompt,
  classifierPrompt,
  directAnswerPrompt,
  generateClausesPrompt,
  generateGraphPrompt,
} from "./prompts";
import {
  type AnswerOutput,
  answerOutputSchema,
  bridgeEdgesOutputSchema,
  type ClassifierOutput,
  type ClausesOutput,
  classifierOutputSchema,
  clausesOutputSchema,
  type DirectAnswerOutput,
  directAnswerOutputSchema,
  type GraphOutput,
  graphOutputSchema,
} from "./schemas";
import type { StudyQuestionFixture } from "./study-fixtures";
import { streamStudyAnswer, streamStudyClauses } from "./study-stream";

const KGQA_MODEL = "openai/gpt-4.1";
const STUDY_GRAPH_BATCH_SIZE = 5;
const STUDY_GRAPH_BATCH_DELAY_MS = 40;

const JUNK_NODES = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
  "with",
  "from",
  "into",
  "about",
  "between",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "under",
  "over",
  "up",
  "out",
  "off",
  "down",
  "near",
  "upon",
  "or",
  "and",
  "but",
  "nor",
  "so",
  "yet",
  "he",
  "she",
  "we",
  "us",
  "me",
  "my",
  "his",
  "her",
  "its",
  "our",
  "your",
  "it",
  "them",
  "they",
  "i",
  "not",
  "no",
  "if",
  "as",
  "than",
  "then",
  "also",
  "just",
  "very",
  "that",
  "this",
  "these",
  "those",
  "who",
  "what",
  "when",
  "where",
  "why",
  "how",
  "here",
  "there",
]);

function isValidNode(node: string): boolean {
  const trimmed = node.trim();
  if (trimmed.length < 2) {
    return false;
  }
  if (JUNK_NODES.has(trimmed.toLowerCase())) {
    return false;
  }
  return true;
}

type KGQAWorkflowResult = {
  clauses: ClausesOutput | null;
  graph: GraphOutput | null;
  answer: AnswerOutput | null;
  error?: string;
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function buildGraphText(graph: GraphOutput) {
  return graph.triples
    .map(
      (t, i) =>
        `${i + 1}. [${t.score.toFixed(2)}] (${t.node1}, ${t.relationship}, ${t.node2})`
    )
    .join("\n");
}

async function generateKGQAAnswer({
  dataStream,
  graph,
  question,
}: {
  dataStream: UIMessageStreamWriter<ChatMessage>;
  graph: GraphOutput;
  question: string;
}) {
  dataStream.write({
    type: "data-kgqa-step",
    data: "answer",
  });

  let answer: AnswerOutput | null = null;

  try {
    const answerResult = streamObject({
      model: gateway.languageModel(KGQA_MODEL),
      system: answerWithGraphPrompt,
      prompt: `Question: ${question}\n\nKnowledge Graph:\n${buildGraphText(graph)}`,
      schema: answerOutputSchema,
    });

    for await (const delta of answerResult.fullStream) {
      if (delta.type === "object" && delta.object) {
        const obj = delta.object as Partial<AnswerOutput>;
        if (obj.answer || obj.reasoning) {
          dataStream.write({
            type: "data-kgqa-answer",
            data: obj,
          });
          answer = obj as AnswerOutput;
        }
      }
    }

    const finalAnswer = await answerResult.object;
    answer = finalAnswer;
    dataStream.write({
      type: "data-kgqa-answer",
      data: answer,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate answer";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { answer: null, error: errorMessage };
  }

  dataStream.write({
    type: "data-kgqa-step",
    data: "complete",
  });

  return { answer, error: undefined };
}

function buildStudyGraphFrames(graph: GraphOutput) {
  const frames: GraphOutput[] = [];

  for (
    let index = STUDY_GRAPH_BATCH_SIZE;
    index < graph.triples.length;
    index += STUDY_GRAPH_BATCH_SIZE
  ) {
    frames.push({
      triples: graph.triples.slice(0, index),
    });
  }

  frames.push(graph);

  return frames;
}

export async function runKGQAWorkflow({
  question,
  dataStream,
}: {
  question: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}): Promise<KGQAWorkflowResult> {
  dataStream.write({
    type: "data-kgqa-step",
    data: "clauses",
  });

  let clauses: ClausesOutput | null = null;

  try {
    const clausesResult = streamObject({
      model: gateway.languageModel(KGQA_MODEL),
      system: generateClausesPrompt,
      prompt: question,
      schema: clausesOutputSchema,
    });

    for await (const delta of clausesResult.fullStream) {
      if (delta.type === "object" && delta.object) {
        const obj = delta.object as Partial<ClausesOutput>;
        if (obj.clauses && obj.clauses.length > 0) {
          dataStream.write({
            type: "data-kgqa-clauses",
            data: obj as ClausesOutput,
          });
          clauses = obj as ClausesOutput;
        }
      }
    }

    const finalClauses = await clausesResult.object;
    clauses = finalClauses;
    dataStream.write({
      type: "data-kgqa-clauses",
      data: clauses,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate clauses";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { clauses: null, graph: null, answer: null, error: errorMessage };
  }

  if (!clauses || clauses.clauses.length === 0) {
    const errorMessage = "No clauses generated";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { clauses: null, graph: null, answer: null, error: errorMessage };
  }

  clauses.clauses = clauses.clauses.filter(
    (c) => isValidNode(c.node1) && isValidNode(c.node2)
  );
  if (clauses.clauses.length === 0) {
    const errorMessage = "No valid clauses after filtering";
    dataStream.write({ type: "data-kgqa-error", data: errorMessage });
    dataStream.write({ type: "data-kgqa-step", data: "error" });
    return { clauses: null, graph: null, answer: null, error: errorMessage };
  }
  dataStream.write({ type: "data-kgqa-clauses", data: clauses });

  if (!isPathConnected(clauses.clauses)) {
    const errorMessage =
      "Clause path is disconnected — clauses do not form a connected reasoning chain";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { clauses, graph: null, answer: null, error: errorMessage };
  }

  dataStream.write({
    type: "data-kgqa-step",
    data: "graph",
  });

  let graph: GraphOutput | null = null;

  const clausesText = clauses.clauses
    .map((c, i) => `${i + 1}. (${c.node1}, ${c.relationship}, ${c.node2})`)
    .join("\n");

  try {
    const graphResult = streamObject({
      model: gateway.languageModel(KGQA_MODEL),
      system: generateGraphPrompt,
      prompt: `Question: ${question}\n\nClauses:\n${clausesText}`,
      schema: graphOutputSchema,
    });

    for await (const delta of graphResult.fullStream) {
      if (delta.type === "object" && delta.object) {
        const obj = delta.object as Partial<GraphOutput>;
        if (obj.triples && obj.triples.length > 0) {
          dataStream.write({
            type: "data-kgqa-graph",
            data: obj as GraphOutput,
          });
          graph = obj as GraphOutput;
        }
      }
    }

    const finalGraph = await graphResult.object;
    graph = finalGraph;
    dataStream.write({
      type: "data-kgqa-graph",
      data: graph,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate graph";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { clauses, graph: null, answer: null, error: errorMessage };
  }

  if (!graph || graph.triples.length === 0) {
    const errorMessage = "No graph generated";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { clauses, graph: null, answer: null, error: errorMessage };
  }

  graph.triples = graph.triples.filter(
    (t) => isValidNode(t.node1) && isValidNode(t.node2)
  );
  for (const triple of graph.triples) {
    triple.score = Math.max(0, Math.min(1, triple.score));
  }

  const existingEdges = new Set(
    graph.triples.map((t) => `${t.node1}|${t.relationship}|${t.node2}`)
  );
  for (const clause of clauses.clauses) {
    const key = `${clause.node1}|${clause.relationship}|${clause.node2}`;
    if (!existingEdges.has(key)) {
      graph.triples.push({
        score: 1.0,
        node1: clause.node1,
        relationship: clause.relationship,
        node2: clause.node2,
      });
    }
  }

  const MAX_BRIDGE_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_BRIDGE_ATTEMPTS; attempt++) {
    if (isGraphConnected(graph.triples)) {
      break;
    }

    const components = findConnectedComponents(graph.triples);
    const prompt = buildBridgePrompt(components);

    try {
      const bridgeResult = await generateObject({
        model: gateway.languageModel(KGQA_MODEL),
        system: bridgeEdgesPrompt,
        prompt,
        schema: bridgeEdgesOutputSchema,
      });

      for (const triple of bridgeResult.object.triples) {
        graph.triples.push(triple);
      }
    } catch {
      break;
    }
  }

  dataStream.write({
    type: "data-kgqa-graph",
    data: graph,
  });

  const { answer, error: answerError } = await generateKGQAAnswer({
    dataStream,
    graph,
    question,
  });

  if (answerError) {
    return { clauses, graph, answer: null, error: answerError };
  }

  return {
    clauses,
    graph,
    answer,
  };
}

export async function runStudyQuestionWorkflow({
  question: _question,
  dataStream,
  fixture,
}: {
  question: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  fixture: StudyQuestionFixture;
}): Promise<KGQAWorkflowResult> {
  dataStream.write({
    type: "data-kgqa-step",
    data: "clauses",
  });

  await streamStudyClauses({ dataStream, fixture });

  if (!fixture.isCorrect) {
    dataStream.write({
      type: "data-kgqa-incorrect",
      data: true,
    });
  }

  dataStream.write({
    type: "data-kgqa-step",
    data: "graph",
  });

  for (const frame of buildStudyGraphFrames(fixture.graph)) {
    dataStream.write({
      type: "data-kgqa-graph",
      data: frame,
    });
    await wait(STUDY_GRAPH_BATCH_DELAY_MS);
  }

  const { answer, reasoning } = await streamStudyAnswer({
    dataStream,
    fixture,
  });

  return {
    clauses: fixture.clauses,
    graph: fixture.graph,
    answer: { answer, reasoning },
  };
}

export async function runClassifier({
  question,
  userSelection,
  dataStream,
}: {
  question: string;
  userSelection: string[];
  dataStream: UIMessageStreamWriter<ChatMessage>;
}): Promise<ClassifierOutput> {
  dataStream.write({
    type: "data-kgqa-step",
    data: "classify",
  });

  const selectionText = userSelection.join(", ");
  const prompt = `### USER SELECTION
${selectionText}

### QUESTION
${question}`;

  try {
    const result = streamObject({
      model: gateway.languageModel(KGQA_MODEL),
      system: classifierPrompt,
      prompt,
      schema: classifierOutputSchema,
    });

    let classification: ClassifierOutput | null = null;

    for await (const delta of result.fullStream) {
      if (delta.type === "object" && delta.object) {
        const obj = delta.object as Partial<ClassifierOutput>;
        if (obj.category) {
          classification = obj as ClassifierOutput;
          dataStream.write({
            type: "data-kgqa-classify",
            data: classification,
          });
        }
      }
    }

    const finalResult = await result.object;
    dataStream.write({
      type: "data-kgqa-classify",
      data: finalResult,
    });

    return finalResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to classify question";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    return { category: "Contained" };
  }
}

export async function runDirectAnswer({
  question,
  dataStream,
}: {
  question: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}): Promise<DirectAnswerOutput> {
  dataStream.write({
    type: "data-kgqa-step",
    data: "answer",
  });

  try {
    const result = streamObject({
      model: gateway.languageModel(KGQA_MODEL),
      system: directAnswerPrompt,
      prompt: question,
      schema: directAnswerOutputSchema,
    });

    let answer: DirectAnswerOutput | null = null;

    for await (const delta of result.fullStream) {
      if (delta.type === "object" && delta.object) {
        const obj = delta.object as Partial<DirectAnswerOutput>;
        if (obj.answer || obj.reasoning) {
          answer = obj as DirectAnswerOutput;
          dataStream.write({
            type: "data-kgqa-direct-answer",
            data: answer,
          });
        }
      }
    }

    const finalResult = await result.object;
    dataStream.write({
      type: "data-kgqa-direct-answer",
      data: finalResult,
    });

    dataStream.write({
      type: "data-kgqa-step",
      data: "complete",
    });

    return finalResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate answer";
    dataStream.write({
      type: "data-kgqa-error",
      data: errorMessage,
    });
    dataStream.write({
      type: "data-kgqa-step",
      data: "error",
    });
    return { answer: "", reasoning: errorMessage };
  }
}
