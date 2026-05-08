"use client";

import { HelpCircleIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTutorial } from "@/hooks/use-tutorial";

interface TutorialCard {
  id: string;
  target: string;
  title: string;
  description: string;
}

const CARDS: TutorialCard[] = [
  {
    id: "chat-panel",
    target: "chat-panel",
    title: "Chat Panel",
    description:
      "Type questions here. Lasso-select documents in the scatterplot to focus your query on specific topics.",
  },
  {
    id: "graph-area",
    target: "graph-area",
    title: "Answer Graph",
    description:
      "Shows the subgraph of the knowledge base relevant to the answer, along with the path (if found) that supports it.",
  },
  {
    id: "scatterplot-panel",
    target: "scatterplot-panel",
    title: "Dataset Explorer",
    description:
      "Click a node to generate a sample question about that topic. Shift + drag to select multiple nodes to focus your query. Double-click to deselect.",
  },
];

interface CardPosition {
  top: number;
  left: number;
}

const HINT_AUTO_DISMISS_MS = 5000;

function TutorialHint() {
  const { showHint, dismissHint, start: startTutorial } = useTutorial();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showHint) {
      return;
    }
    const timer = setTimeout(dismissHint, HINT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [showHint, dismissHint]);

  if (!mounted || !showHint) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
      <Card className="w-[280px] shadow-lg border-border/50">
        <CardContent className="flex items-center gap-3 p-3">
          <HelpCircleIcon className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click the{" "}
            <button
              className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
              onClick={() => {
                dismissHint();
                startTutorial();
              }}
              type="button"
            >
              <HelpCircleIcon className="inline size-3" /> tutorial
            </button>{" "}
            button to learn how to use this tool.
          </p>
          <Button
            className="size-6 shrink-0"
            onClick={dismissHint}
            size="icon"
            variant="ghost"
          >
            <XIcon className="size-3 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FullTutorialOverlay() {
  const [mounted, setMounted] = useState(false);
  const { isActive, dismiss, dismissCard, dismissedCards } = useTutorial();
  const [positions, setPositions] = useState<Map<string, CardPosition>>(
    new Map()
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const compute = () => {
      const newPositions = new Map<string, CardPosition>();
      for (const card of CARDS) {
        const el = document.querySelector(`[data-tutorial="${card.target}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          newPositions.set(card.id, {
            top: rect.top + rect.height / 2,
            left: rect.left + rect.width / 2,
          });
        }
      }
      setPositions(newPositions);
    };

    const timer = setTimeout(compute, 300);
    window.addEventListener("resize", compute);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", compute);
    };
  }, [isActive]);

  if (!mounted || !isActive) return null;

  const visibleCards = CARDS.filter((c) => !dismissedCards.has(c.id));
  if (visibleCards.length === 0) {
    dismiss();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40">
      <div className="absolute top-4 right-4 z-[101]">
        <Button className="shadow-lg" onClick={dismiss} variant="outline">
          Dismiss All
        </Button>
      </div>

      {visibleCards.map((card) => {
        const pos = positions.get(card.id);
        if (!pos) return null;

        const cardWidth = 260;
        const cardTop = Math.max(
          16,
          Math.min(pos.top - 60, window.innerHeight - 150)
        );
        const cardLeft = Math.max(
          16,
          Math.min(pos.left - cardWidth / 2, window.innerWidth - cardWidth - 16)
        );

        return (
          <Card
            className="absolute z-[101] w-[260px] shadow-xl"
            key={card.id}
            style={{ top: cardTop, left: cardLeft }}
          >
            <CardHeader className="p-4 pb-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{card.title}</CardTitle>
                <Button
                  className="size-6 shrink-0"
                  onClick={() => dismissCard(card.id)}
                  size="icon"
                  variant="ghost"
                >
                  <XIcon className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1.5">
              <CardDescription className="text-xs leading-relaxed">
                {card.description}
              </CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function TutorialOverlay() {
  return (
    <>
      <TutorialHint />
      <FullTutorialOverlay />
    </>
  );
}
