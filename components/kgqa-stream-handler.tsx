"use client";

import { useEffect } from "react";
import type {
  AnswerOutput,
  ClassifierOutput,
  ClausesOutput,
  DirectAnswerOutput,
  GraphOutput,
} from "@/lib/ai/kgqa/schemas";
import type { KGQAStep } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { useKGQA } from "./kgqa-provider";

export function KGQAStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { setStep, setClassification, setClauses, setGraph, setAnswer, setDirectAnswer, setError, setIncorrectStudyQuestion, reset } =
    useKGQA();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const kgqaDeltas = dataStream.filter(
      (delta) =>
        delta.type === "data-kgqa-step" ||
        delta.type === "data-kgqa-classify" ||
        delta.type === "data-kgqa-clauses" ||
        delta.type === "data-kgqa-graph" ||
        delta.type === "data-kgqa-answer" ||
        delta.type === "data-kgqa-direct-answer" ||
        delta.type === "data-kgqa-error" ||
        delta.type === "data-kgqa-incorrect"
    );

    if (kgqaDeltas.length === 0) {
      return;
    }

    const remainingDeltas = dataStream.filter(
      (delta) =>
        delta.type !== "data-kgqa-step" &&
        delta.type !== "data-kgqa-classify" &&
        delta.type !== "data-kgqa-clauses" &&
        delta.type !== "data-kgqa-graph" &&
        delta.type !== "data-kgqa-answer" &&
        delta.type !== "data-kgqa-direct-answer" &&
        delta.type !== "data-kgqa-error" &&
        delta.type !== "data-kgqa-incorrect"
    );

    setDataStream(remainingDeltas);

    for (const delta of kgqaDeltas) {
      switch (delta.type) {
        case "data-kgqa-step": {
          const step = delta.data as KGQAStep;
          if (step === "classify" || step === "clauses") {
            reset();
          }
          setStep(step);
          break;
        }
        case "data-kgqa-classify":
          setClassification(delta.data as ClassifierOutput);
          break;
        case "data-kgqa-clauses":
          setClauses(delta.data as ClausesOutput);
          break;
        case "data-kgqa-graph":
          setGraph(delta.data as GraphOutput);
          break;
        case "data-kgqa-answer":
          setAnswer(delta.data as Partial<AnswerOutput>);
          break;
        case "data-kgqa-direct-answer":
          setDirectAnswer(delta.data as Partial<DirectAnswerOutput>);
          break;
        case "data-kgqa-error":
          setError(delta.data as string);
          break;
        case "data-kgqa-incorrect":
          setIncorrectStudyQuestion(true);
          break;
      }
    }
  }, [
    dataStream,
    setDataStream,
    setStep,
    setClassification,
    setClauses,
    setGraph,
    setAnswer,
    setDirectAnswer,
    setError,
    setIncorrectStudyQuestion,
    reset,
  ]);

  return null;
}
