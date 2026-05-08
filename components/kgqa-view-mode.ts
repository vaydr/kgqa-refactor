export const KGQA_VIEW_MODES = ["both", "answer-only"] as const;

export type KGQAViewMode = (typeof KGQA_VIEW_MODES)[number];

export const KGQA_VIEW_MODE_LABELS: Record<KGQAViewMode, string> = {
  both: "Both",
  "answer-only": "Answer only",
};

export const KGQA_VIEW_MODE_URL_PARAMS: Record<KGQAViewMode, string> = {
  both: "both",
  "answer-only": "ans",
};

export function parseKGQAViewModeParam(value: string | null): KGQAViewMode {
  if (value === "ans") return "answer-only";
  return "both";
}

export function getKGQAViewPresentation(mode: KGQAViewMode) {
  return {
    blurAssistant: false,
    blurGraph: mode === "answer-only",
    blurAnswer: false,
  };
}
