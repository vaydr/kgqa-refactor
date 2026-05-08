"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AnswerOutput,
  ClassifierOutput,
  ClausesOutput,
  DirectAnswerOutput,
  GraphOutput,
} from "@/lib/ai/kgqa/schemas";
import type { KGQAStep } from "@/lib/types";

type KGQAState = {
  step: KGQAStep | "idle";
  classification: ClassifierOutput | null;
  clauses: ClausesOutput | null;
  graph: GraphOutput | null;
  answer: Partial<AnswerOutput> | null;
  directAnswer: Partial<DirectAnswerOutput> | null;
  error: string | null;
  isIncorrectStudyQuestion: boolean;
};

type KGQAContextValue = {
  state: KGQAState;
  setStep: (step: KGQAStep | "idle") => void;
  setClassification: (classification: ClassifierOutput) => void;
  setClauses: (clauses: ClausesOutput) => void;
  setGraph: (graph: GraphOutput) => void;
  setAnswer: (answer: Partial<AnswerOutput>) => void;
  setDirectAnswer: (answer: Partial<DirectAnswerOutput>) => void;
  setError: (error: string) => void;
  setIncorrectStudyQuestion: (value: boolean) => void;
  reset: () => void;
};

const initialState: KGQAState = {
  step: "idle",
  classification: null,
  clauses: null,
  graph: null,
  answer: null,
  directAnswer: null,
  error: null,
  isIncorrectStudyQuestion: false,
};

const KGQAContext = createContext<KGQAContextValue | null>(null);

export function KGQAProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KGQAState>(initialState);

  const setStep = useCallback((step: KGQAStep | "idle") => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setClassification = useCallback((classification: ClassifierOutput) => {
    setState((prev) => ({ ...prev, classification }));
  }, []);

  const setClauses = useCallback((clauses: ClausesOutput) => {
    setState((prev) => ({ ...prev, clauses }));
  }, []);

  const setGraph = useCallback((graph: GraphOutput) => {
    setState((prev) => ({ ...prev, graph }));
  }, []);

  const setAnswer = useCallback((answer: Partial<AnswerOutput>) => {
    setState((prev) => ({
      ...prev,
      answer: prev.answer ? { ...prev.answer, ...answer } : answer,
    }));
  }, []);

  const setDirectAnswer = useCallback((answer: Partial<DirectAnswerOutput>) => {
    setState((prev) => ({
      ...prev,
      directAnswer: prev.directAnswer ? { ...prev.directAnswer, ...answer } : answer,
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error, step: "error" }));
  }, []);

  const setIncorrectStudyQuestion = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isIncorrectStudyQuestion: value }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
      setStep,
      setClassification,
      setClauses,
      setGraph,
      setAnswer,
      setDirectAnswer,
      setError,
      setIncorrectStudyQuestion,
      reset,
    }),
    [state, setStep, setClassification, setClauses, setGraph, setAnswer, setDirectAnswer, setError, setIncorrectStudyQuestion, reset]
  );

  return <KGQAContext.Provider value={value}>{children}</KGQAContext.Provider>;
}

export function useKGQA() {
  const context = useContext(KGQAContext);
  if (!context) {
    throw new Error("useKGQA must be used within KGQAProvider");
  }
  return context;
}
