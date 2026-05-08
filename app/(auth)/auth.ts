import { getUser } from "@/lib/db/queries";

export type UserType = "regular";

const ANONYMOUS_EMAIL = "anonymous@local";

let cachedUserId: string | null = null;

async function getOrCreateAnonymousUser(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }
  const existing = await getUser(ANONYMOUS_EMAIL);
  if (existing.length > 0) {
    cachedUserId = existing[0].id;
    return cachedUserId;
  }
  const { createUser } = await import("@/lib/db/queries");
  await createUser(ANONYMOUS_EMAIL, "");
  const created = await getUser(ANONYMOUS_EMAIL);
  cachedUserId = created[0].id;
  return cachedUserId;
}

export type Session = {
  user: {
    id: string;
    email: string;
    type: UserType;
  };
};

export async function auth(): Promise<Session> {
  const id = await getOrCreateAnonymousUser();
  return {
    user: {
      id,
      email: ANONYMOUS_EMAIL,
      type: "regular",
    },
  };
}
