import equal from "fast-deep-equal";
import { Eye, EyeOff } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon } from "./icons";
import { useScatterplot } from "./scatterplot-provider";

export function PureMessageActions({
  chatId,
  message,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();
  const { state, getMessageSelection, restoreMessageSelection, clearSelection } = useScatterplot();

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const messageSelection = getMessageSelection(message.id);
  const hasSelection = (messageSelection?.length ?? 0) > 0;
  const currentSelectionIds = state.selectedPoints.map(p => p.id);
  const isSelectionActive = hasSelection &&
    messageSelection!.length === currentSelectionIds.length &&
    messageSelection!.every(id => currentSelectionIds.includes(id));

  const handleToggleSelection = () => {
    if (isSelectionActive) {
      clearSelection();
    } else {
      restoreMessageSelection(message.id);
    }
  };

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end">
        <div className="relative">
          {hasSelection && (
            <Action
              className="-left-20 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
              onClick={handleToggleSelection}
              tooltip={isSelectionActive ? "Hide selection" : "Show selection"}
            >
              {isSelectionActive ? <EyeOff size={14} /> : <Eye size={14} />}
            </Action>
          )}
          {setMode && (
            <Action
              className="-left-10 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
              data-testid="message-edit-button"
              onClick={() => setMode("edit")}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip="Copy">
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5">
      <Action onClick={handleCopy} tooltip="Copy">
        <CopyIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }

    return true;
  }
);
