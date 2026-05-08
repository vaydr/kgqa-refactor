"use client";

import { HelpCircleIcon, PlusIcon, TerminalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import {
  KGQA_VIEW_MODE_LABELS,
  KGQA_VIEW_MODES,
  type KGQAViewMode,
} from "@/components/kgqa-view-mode";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTutorial } from "@/hooks/use-tutorial";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  kgqaViewMode,
  onKGQAViewModeChange,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  kgqaViewMode: KGQAViewMode;
  onKGQAViewModeChange: (mode: KGQAViewMode) => void;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { start: startTutorial } = useTutorial();
  const { width: windowWidth } = useWindowSize();

  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-border/30 border-b bg-background/80 px-2 py-1 backdrop-blur-sm">
      <SidebarToggle />

      <div className="flex items-center gap-1.5 text-muted-foreground/50">
        <TerminalIcon className="size-3" />
        <span className="font-mono text-[9px] uppercase tracking-[0.15em]">
          Query
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="mr-2 hidden items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[9px] text-muted-foreground/70 uppercase tracking-[0.15em] md:inline-flex"
              data-testid="webqsp-dataset-badge"
            >
              WebQSP
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Study questions sampled from the WebQSP benchmark
          </TooltipContent>
        </Tooltip>

        <div
          aria-label="KGQA view mode"
          className="mr-2 hidden items-center rounded-md border border-border/60 bg-muted/30 p-0.5 md:inline-flex"
          data-testid="kgqa-view-mode-selector"
          role="radiogroup"
        >
          {KGQA_VIEW_MODES.map((mode) => {
            const active = kgqaViewMode === mode;
            return (
              <button
                aria-checked={active}
                className={`cursor-pointer rounded-sm px-2.5 py-1 font-medium text-[10px] uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-blue-500/15 text-blue-700 shadow-sm dark:text-blue-200"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-active={active}
                data-testid={`kgqa-view-mode-${mode}`}
                key={mode}
                onClick={() => onKGQAViewModeChange(mode)}
                role="radio"
                type="button"
              >
                {KGQA_VIEW_MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

        {(!open || (windowWidth && windowWidth < 768)) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-7 p-0"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
                variant="ghost"
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="size-7 p-0"
              onClick={startTutorial}
              variant="ghost"
            >
              <HelpCircleIcon className="size-3.5 text-muted-foreground/40" />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="end" side="bottom">Show tutorial</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.kgqaViewMode === nextProps.kgqaViewMode &&
    prevProps.onKGQAViewModeChange === nextProps.onKGQAViewModeChange &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
