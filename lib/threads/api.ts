import "server-only";

const AUTH_BASE = "https://www.threads.net/oauth/authorize";
const GRAPH_BASE = "https://graph.threads.net";

export const THREADS_SCOPES = [
  "threads_basic",
  "threads_keyword_search",
  "threads_manage_replies",
  "threads_content_publish",
].join(",");

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID ?? "",
    redirect_uri: process.env.THREADS_REDIRECT_URI ?? "",
    scope: THREADS_SCOPES,
    response_type: "code",
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

type ShortLivedTokenResponse = {
  access_token: string;
  user_id: number;
};

type LongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function exchangeCodeForShortToken(code: string): Promise<ShortLivedTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID ?? "",
    client_secret: process.env.THREADS_APP_SECRET ?? "",
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.THREADS_REDIRECT_URI ?? "",
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

export async function exchangeForLongLivedToken(
  shortToken: string
): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: process.env.THREADS_APP_SECRET ?? "",
    access_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`long-lived token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

type ThreadsUser = {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
};

export async function getMe(token: string): Promise<ThreadsUser> {
  const params = new URLSearchParams({
    fields: "id,username,threads_profile_picture_url",
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/v1.0/me?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`getMe failed: ${res.status} ${err}`);
  }
  return res.json();
}

export type ThreadsPost = {
  id: string;
  text?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
};

type KeywordSearchResponse = {
  data: ThreadsPost[];
};

export async function keywordSearch(
  token: string,
  query: string,
  searchType: "TOP" | "RECENT" = "TOP",
  limit = 50
): Promise<ThreadsPost[]> {
  const params = new URLSearchParams({
    q: query,
    search_type: searchType,
    fields: "id,text,permalink,timestamp,username",
    limit: String(limit),
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/v1.0/keyword_search?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`keyword_search failed: ${res.status} ${err}`);
  }
  const json = (await res.json()) as KeywordSearchResponse;
  return json.data ?? [];
}

type MyThreadsPost = {
  id: string;
  permalink?: string;
  text?: string;
  timestamp?: string;
};

export async function listMyThreads(
  userId: string,
  token: string,
  limit = 25
): Promise<MyThreadsPost[]> {
  const params = new URLSearchParams({
    fields: "id,permalink,text,timestamp",
    limit: String(limit),
    access_token: token,
  });
  const res = await fetch(`${GRAPH_BASE}/v1.0/${userId}/threads?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`listMyThreads failed: ${res.status} ${err}`);
  }
  const json = (await res.json()) as { data: MyThreadsPost[] };
  return json.data ?? [];
}

export async function findPostIdByUrl(
  userId: string,
  token: string,
  url: string
): Promise<string | null> {
  const shortcode = url.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1];
  if (!shortcode) return null;
  const posts = await listMyThreads(userId, token, 50);
  const match = posts.find((p) => p.permalink?.includes(`/post/${shortcode}`));
  return match?.id ?? null;
}

async function getContainerStatus(
  containerId: string,
  token: string
): Promise<string> {
  const params = new URLSearchParams({ fields: "status", access_token: token });
  const res = await fetch(`${GRAPH_BASE}/v1.0/${containerId}?${params.toString()}`);
  if (!res.ok) return "UNKNOWN";
  const json = (await res.json()) as { status?: string };
  return json.status ?? "UNKNOWN";
}

export async function createPost(
  userId: string,
  token: string,
  text: string
): Promise<{ id: string }> {
  const createParams = new URLSearchParams({
    media_type: "TEXT",
    text,
    access_token: token,
  });
  const createRes = await fetch(
    `${GRAPH_BASE}/v1.0/${userId}/threads?${createParams.toString()}`,
    { method: "POST" }
  );
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`create container failed: ${createRes.status} ${err}`);
  }
  const { id: creationId } = (await createRes.json()) as { id: string };

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await getContainerStatus(creationId, token);
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`container status ${status}`);
    }
  }

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: token,
  });
  const publishRes = await fetch(
    `${GRAPH_BASE}/v1.0/${userId}/threads_publish?${publishParams.toString()}`,
    { method: "POST" }
  );
  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`publish failed: ${publishRes.status} ${err}`);
  }
  return publishRes.json();
}

export async function createReply(
  userId: string,
  token: string,
  text: string,
  replyToId: string
): Promise<{ id: string }> {
  const createParams = new URLSearchParams({
    media_type: "TEXT",
    text,
    reply_to_id: replyToId,
    access_token: token,
  });
  const createRes = await fetch(
    `${GRAPH_BASE}/v1.0/${userId}/threads?${createParams.toString()}`,
    { method: "POST" }
  );
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`create container failed: ${createRes.status} ${err}`);
  }
  const { id: creationId } = (await createRes.json()) as { id: string };

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await getContainerStatus(creationId, token);
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`container status ${status}`);
    }
  }

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: token,
  });
  const publishRes = await fetch(
    `${GRAPH_BASE}/v1.0/${userId}/threads_publish?${publishParams.toString()}`,
    { method: "POST" }
  );
  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`publish failed: ${publishRes.status} ${err}`);
  }
  return publishRes.json();
}
