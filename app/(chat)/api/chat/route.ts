import {
  createUIMessageStream,
  JsonToSseTransformStream,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  runClassifier,
  runDirectAnswer,
  runKGQAWorkflow,
  runStudyQuestionWorkflow,
} from "@/lib/ai/kgqa/agents";
import { STUDY_QUESTION_FIXTURES } from "@/lib/ai/kgqa/study-fixtures";
import { detectStudyQuestionExact } from "@/lib/ai/kgqa/study-stream";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function writeAssistantText({
  dataStream,
  text,
}: {
  dataStream: Parameters<
    NonNullable<Parameters<typeof createUIMessageStream>[0]["execute"]>
  >[0]["writer"];
  text: string;
}) {
  const partId = generateUUID();
  dataStream.write({ type: "text-start", id: partId });
  dataStream.write({ type: "text-delta", delta: text, id: partId });
  dataStream.write({ type: "text-end", id: partId });
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedVisibilityType, userSelection } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });

      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        if (titlePromise) {
          titlePromise.then((title) => {
            updateChatTitleById({ chatId: id, title });
            dataStream.write({ type: "data-chat-title", data: title });
          });
        }

        const lastUserMessage = uiMessages
          .filter((m) => m.role === "user")
          .at(-1);
        const question = lastUserMessage?.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text"
          )
          .map((p) => p.text)
          .join(" ");

        if (!question) {
          dataStream.write({
            type: "data-kgqa-error",
            data: "No question found in message",
          });
          dataStream.write({
            type: "data-kgqa-step",
            data: "error",
          });
          return;
        }

        const hasSelection = Boolean(userSelection && userSelection.length > 0);

        const studyQuestionId = detectStudyQuestionExact(question);
        if (studyQuestionId) {
          const studyFixture = STUDY_QUESTION_FIXTURES[studyQuestionId];
          const kgqaResult = await runStudyQuestionWorkflow({
            question,
            dataStream,
            fixture: studyFixture,
          });

          if (kgqaResult.answer) {
            writeAssistantText({
              dataStream,
              text: `<answer>${kgqaResult.answer.answer}</answer>

${kgqaResult.answer.reasoning || ""}`,
            });
          }

          return;
        }

        const studyRoute = hasSelection ? "classifier" : "kgqa";

        if (studyRoute === "kgqa") {
          const kgqaResult = await runKGQAWorkflow({
            question,
            dataStream,
          });

          if (kgqaResult.answer) {
            writeAssistantText({
              dataStream,
              text: `<answer>${kgqaResult.answer.answer}</answer>

${kgqaResult.answer.reasoning || ""}`,
            });
          }
        } else {
          const classification = await runClassifier({
            question,
            userSelection: userSelection!,
            dataStream,
          });

          if (classification.category === "Contained") {
            const kgqaResult = await runKGQAWorkflow({
              question,
              dataStream,
            });

            if (kgqaResult.answer) {
              writeAssistantText({
                dataStream,
                text: `<answer>${kgqaResult.answer.answer}</answer>

${kgqaResult.answer.reasoning || ""}`,
              });
            }
          } else {
            const directResult = await runDirectAnswer({
              question,
              dataStream,
            });

            if (directResult.answer) {
              writeAssistantText({
                dataStream,
                text: `<uncontained-answer>${directResult.answer}</uncontained-answer>

${directResult.reasoning || ""}`,
              });
            }
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      try {
        const resumableStream = await streamContext.resumableStream(
          streamId,
          () => stream.pipeThrough(new JsonToSseTransformStream())
        );
        if (resumableStream) {
          return new Response(resumableStream);
        }
      } catch (error) {
        console.error("Failed to create resumable stream:", error);
      }
    }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
