"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "tutorial-shown-this-session";
const HINT_STORAGE_KEY = "tutorial-hint-dismissed";

interface TutorialContextValue {
  isActive: boolean;
  start: () => void;
  dismiss: () => void;
  dismissCard: (id: string) => void;
  dismissedCards: Set<string>;
  completed: boolean;
  showHint: boolean;
  dismissHint: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      const tutorialDone = sessionStorage.getItem(STORAGE_KEY);
      const hintDismissed = sessionStorage.getItem(HINT_STORAGE_KEY);
      if (tutorialDone === "true") {
        setCompleted(true);
      } else if (hintDismissed !== "true") {
        setShowHint(true);
      }
    } catch {
      // noop
    }
  }, []);

  const start = useCallback(() => {
    setShowHint(false);
    setDismissedCards(new Set());
    setIsActive(true);
  }, []);

  const dismiss = useCallback(() => {
    setIsActive(false);
    setCompleted(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // noop
    }
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try {
      sessionStorage.setItem(HINT_STORAGE_KEY, "true");
    } catch {
      // noop
    }
  }, []);

  const dismissCard = useCallback((id: string) => {
    setDismissedCards((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return (
    <TutorialContext.Provider value={{ isActive, start, dismiss, dismissCard, dismissedCards, completed, showHint, dismissHint }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
}
