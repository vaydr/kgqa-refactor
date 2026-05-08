"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useScatterplot } from "./scatterplot-provider";
import {
  getKGQAViewPresentation,
  type KGQAViewMode,
} from "./kgqa-view-mode";

function parseKGQAResponse(text: string): { answer: string; reasoning: string; isUncontained: boolean } | null {
  const uncontainedMatch = text.match(/<uncontained-answer>([\s\S]*?)<\/uncontained-answer>/);
  if (uncontainedMatch) {
    const answer = uncontainedMatch[1].trim();
    const reasoning = text.replace(/<uncontained-answer>[\s\S]*?<\/uncontained-answer>/, "").trim();
    return { answer, reasoning, isUncontained: true };
  }

  const answerMatch = text.match(/<answer>([\s\S]*?)<\/answer>/);
  if (!answerMatch) return null;

  const answer = answerMatch[1].trim();
  const reasoning = text.replace(/<answer>[\s\S]*?<\/answer>/, "").trim();

  return { answer, reasoning, isUncontained: false };
}
import { useDataStream } from "./data-stream-provider";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
function GraphIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <line stroke="currentColor" opacity={0.3} strokeLinecap="round" strokeWidth={1.5} x1="8" x2="24" y1="8" y2="10" />
      <line stroke="currentColor" opacity={0.3} strokeLinecap="round" strokeWidth={1.5} x1="8" x2="12" y1="8" y2="24" />
      <line stroke="currentColor" opacity={0.3} strokeLinecap="round" strokeWidth={1.5} x1="24" x2="22" y1="10" y2="22" />
      <line stroke="currentColor" opacity={0.3} strokeLinecap="round" strokeWidth={1.5} x1="12" x2="22" y1="24" y2="22" />
      <circle cx="8" cy="8" fill="#3b82f6" r="3.5" />
      <circle cx="24" cy="10" fill="#10b981" r="3" />
      <circle cx="12" cy="24" fill="#f59e0b" r="3" />
      <circle cx="22" cy="22" fill="#ef4444" r="2.5" />
    </svg>
  );
}
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  kgqaViewMode,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  kgqaViewMode: KGQAViewMode;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const { associatePendingSelection, getMessageSelection } = useScatterplot();
  const { blurAssistant } = getKGQAViewPresentation(kgqaViewMode);
  const shouldBlurAssistantMessage =
    blurAssistant && message.role === "assistant";

  const hasSelection = message.role === "user" && (getMessageSelection(message.id)?.length ?? 0) > 0;

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useEffect(() => {
    if (message.role === "user") {
      associatePendingSelection(message.id);
    }
  }, [message.id, message.role, associatePendingSelection]);

  useDataStream();

  return (
    <div
      className="group/message relative w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted/50">
            <GraphIcon size={12} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[85%]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning" && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={part.text}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                const sanitized = sanitizeText(part.text);
                const kgqaParsed = message.role === "assistant" ? parseKGQAResponse(sanitized) : null;

                if (kgqaParsed) {
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      {kgqaParsed.isUncontained && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-red-500/60">
                          Outside selection scope
                        </span>
                      )}
                      {kgqaParsed.answer && (
                        <MessageContent
                          className="bg-transparent px-0 py-0 text-left"
                          data-testid="message-content-answer"
                        >
                          <div className={cn(
                            "text-sm leading-relaxed",
                            kgqaParsed.isUncontained ? "text-muted-foreground" : "text-foreground"
                          )}>
                            <Response>{kgqaParsed.answer}</Response>
                          </div>
                        </MessageContent>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-word w-fit rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-right text-sm":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left text-sm":
                          message.role === "assistant",
                        "message-gradient-animated": hasSelection,
                      })}
                      data-testid="message-content"
                    >
                      <Response>{sanitized}</Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
            />
          )}
        </div>
      </div>

      {shouldBlurAssistantMessage ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg bg-background/20 backdrop-blur-md"
          data-testid="assistant-message-blur-overlay"
        />
      ) : null}
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.message.id === nextProps.message.id &&
      prevProps.kgqaViewMode === nextProps.kgqaViewMode &&
      prevProps.requiresScrollPadding === nextProps.requiresScrollPadding &&
      equal(prevProps.message.parts, nextProps.message.parts)
    ) {
      return true;
    }
    return false;
  }
);

export const ThinkingMessage = ({
  kgqaViewMode,
}: {
  kgqaViewMode: KGQAViewMode;
}) => {
  const { blurAssistant } = getKGQAViewPresentation(kgqaViewMode);

  return (
    <div
      className="relative w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted/50">
          <div className="animate-pulse">
            <GraphIcon size={12} />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground/50">
            Processing
          </span>
          <span className="flex gap-0.5">
            <span className="inline-block size-1 animate-pulse rounded-full bg-muted-foreground/30" style={{ animationDelay: "0ms" }} />
            <span className="inline-block size-1 animate-pulse rounded-full bg-muted-foreground/30" style={{ animationDelay: "150ms" }} />
            <span className="inline-block size-1 animate-pulse rounded-full bg-muted-foreground/30" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>

      {blurAssistant ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg bg-background/20 backdrop-blur-md"
          data-testid="assistant-message-blur-overlay"
        />
      ) : null}
    </div>
  );
};
