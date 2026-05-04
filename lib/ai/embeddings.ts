import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
