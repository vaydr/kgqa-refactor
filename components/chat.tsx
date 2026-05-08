"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useMediaQuery } from "usehooks-ts";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import {
  getStudyFixtureByNumber,
  lookupStudyNumberByText,
  sampleStudyQuestions,
} from "@/lib/ai/kgqa/study-fixtures";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import {
  DEFAULT_CHAT_PANEL_SIZE,
  DEFAULT_DATA_PANEL_SIZE,
} from "./chat-layout";
import { useDataStream } from "./data-stream-provider";
import {
  KGQA_VIEW_MODE_URL_PARAMS,
  type KGQAViewMode,
  parseKGQAViewModeParam,
} from "./kgqa-view-mode";
import { MainContentArea } from "./main-content-area";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { ScatterplotPanel } from "./scatterplot-panel";
import { useScatterplot } from "./scatterplot-provider";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import { TutorialOverlay } from "./tutorial-overlay";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
}) {
  const router = useRouter();

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();

  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId] = useState(initialChatModel);
  const [kgqaViewMode, setKGQAViewMode] = useState<KGQAViewMode>(() => {
    if (typeof window === "undefined") {
      return "both";
    }
    const params = new URLSearchParams(window.location.search);
    return parseKGQAViewModeParam(params.get("mode"));
  });

  const handleKGQAViewModeChange = useCallback((mode: KGQAViewMode) => {
    setKGQAViewMode(mode);
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("mode", KGQA_VIEW_MODE_URL_PARAMS[mode]);
    window.history.replaceState({}, "", url.toString());
  }, []);
  const currentModelIdRef = useRef(currentModelId);

  const userSelectionRef = useRef<string[]>([]);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const suggestCooldownRef = useRef(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { getSelectedContext, captureSelectionForMessage, onPointClick } =
    useScatterplot();

  useEffect(() => {
    return onPointClick((point) => {
      if (suggestCooldownRef.current) {
        return;
      }
      suggestCooldownRef.current = true;
      setTimeout(() => {
        suggestCooldownRef.current = false;
      }, 2000);

      suggestAbortRef.current?.abort();
      const abort = new AbortController();
      suggestAbortRef.current = abort;

      const { title, category, summary } = point.metadata ?? {};
      if (!title) {
        return;
      }

      setInput("");
      setIsSuggesting(true);

      fetch("/api/suggest-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, summary }),
        signal: abort.signal,
      })
        .then(async (res) => {
          if (!res.ok || !res.body) {
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            text += decoder.decode(value, { stream: true });
            setInput(text);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Failed to generate suggestion:", err);
          }
        })
        .finally(() => {
          setIsSuggesting(false);
        });
    });
  }, [onPointClick]);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const captureSelectionTitles = () => {
    const context = getSelectedContext();
    const titles = context
      .map((c) => (c as { title?: string }).title)
      .filter((t): t is string => !!t);
    userSelectionRef.current = titles;
    captureSelectionForMessage();
  };

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      const shouldContinue =
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false;
      return shouldContinue;
    },
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);

        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        const userSelection = userSelectionRef.current;
        userSelectionRef.current = [];

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...(userSelection.length > 0 ? { userSelection } : {}),
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("q");
    if (!raw) {
      return;
    }
    const fixture = getStudyFixtureByNumber(raw);
    if (fixture) {
      setInput(fixture.canonicalQuestion);
    }
  }, []);

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const [sampleQueries] = useState(() =>
    sampleStudyQuestions().map((f) => ({ question: f.canonicalQuestion }))
  );

  const isDesktop = useMediaQuery("(min-width: 1024px)", {
    defaultValue: true,
    initializeWithValue: false,
  });

  const currentQuestion = useMemo(() => {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    return latestUserMessage?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }, [messages]);

  const currentStudyNumber = useMemo(
    () => (currentQuestion ? lookupStudyNumberByText(currentQuestion) : undefined),
    [currentQuestion]
  );

  const chatPane = (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="workspace-pane-chat"
      data-tutorial="chat-panel"
    >
      <ChatHeader
        chatId={id}
        isReadonly={isReadonly}
        kgqaViewMode={kgqaViewMode}
        onKGQAViewModeChange={handleKGQAViewModeChange}
        selectedVisibilityType={initialVisibilityType}
      />

      <Messages
        addToolApprovalResponse={addToolApprovalResponse}
        chatId={id}
        isReadonly={isReadonly}
        kgqaViewMode={kgqaViewMode}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={initialChatModel}
        setMessages={setMessages}
        status={status}
      />

      <div className="border-border/30 border-t px-3 py-2">
        {!isReadonly && (
          <MultimodalInput
            attachments={attachments}
            chatId={id}
            input={input}
            isSuggesting={isSuggesting}
            onBeforeSend={captureSelectionTitles}
            sampleQueries={sampleQueries}
            selectedModelId={currentModelId}
            sendMessage={sendMessage}
            setAttachments={setAttachments}
            setInput={setInput}
            setMessages={setMessages}
            status={status}
            stop={stop}
          />
        )}
      </div>
    </div>
  );

  const dataPane = (
    <div
      className="h-full min-h-0"
      data-testid="workspace-pane-data"
      data-tutorial="scatterplot-panel"
    >
      <ScatterplotPanel />
    </div>
  );

  const graphPane = (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="workspace-pane-graph"
      data-tutorial="graph-area"
    >
      <MainContentArea
        currentQuestion={currentQuestion}
        currentStudyNumber={currentStudyNumber}
        viewMode={kgqaViewMode}
      />
    </div>
  );

  return (
    <>
      {isDesktop ? (
        <ResizablePanelGroup
          autoSaveId="kgqa-workspace-horizontal-v2"
          className="h-dvh w-full"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={26}>
            <ResizablePanelGroup
              autoSaveId="kgqa-workspace-vertical"
              direction="vertical"
            >
              <ResizablePanel
                collapsible
                defaultSize={DEFAULT_DATA_PANEL_SIZE}
                minSize={0}
                style={{ overflow: "visible" }}
              >
                {dataPane}
              </ResizablePanel>
              <ResizableHandle
                data-testid="workspace-handle-vertical"
                withHandle
              />
              <ResizablePanel
                defaultSize={DEFAULT_CHAT_PANEL_SIZE}
                style={{ overflow: "visible" }}
              >
                {chatPane}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle
            data-testid="workspace-handle-horizontal"
            withHandle
          />

          <ResizablePanel defaultSize={74}>{graphPane}</ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-dvh flex-col">
          <div className="min-h-[40vh]">{graphPane}</div>
          <div className="min-h-[30vh]">{dataPane}</div>
          <div className="min-h-[30vh] flex-1">{chatPane}</div>
        </div>
      )}

      <TutorialOverlay />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
