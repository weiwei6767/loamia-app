import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _client;
}

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await getClient().embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
