import { gateway } from "@ai-sdk/gateway";
import { streamText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { title, category, summary } = await request.json();

  if (!title) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const result = streamText({
    model: gateway.languageModel("openai/gpt-4.1-mini"),
    prompt: `You are helping a middle school student explore a knowledge graph about ${category || "science"}.

The student just clicked on a node called "${title}"${summary ? ` which is about: ${summary}` : ""}.

Generate a single short question about "${title}" that:
- Names a SPECIFIC person, place, organism, molecule, or thing (a proper noun or concrete noun) related to "${title}"
- Has an answer that is a specific noun (not a concept or explanation)
- Sounds like a curious kid asking "What is the ___ that ___?" or "Which ___ does ___?"
- Is simple, direct, and not esoteric

Good: "What protein does hemoglobin carry oxygen with?"
Good: "Which planet is closest to the Sun?"
Bad: "What is the nature of consciousness?" (too abstract)
Bad: "How does photosynthesis work?" (answer is a process, not a noun)

Output ONLY the question. No quotes, no prefix, no explanation.`,
    maxOutputTokens: 60,
  });

  return result.toTextStreamResponse();
}
