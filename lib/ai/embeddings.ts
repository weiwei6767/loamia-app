type OpenAIClient = {
  embeddings: {
    create(args: { model: string; input: string[] }): Promise<{
      data: { embedding: number[] }[];
    }>;
  };
};

let _client: OpenAIClient | null = null;
async function getClient(): Promise<OpenAIClient> {
  if (!_client) {
    const { default: OpenAI } = await import("openai");
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) as unknown as OpenAIClient;
  }
  return _client;
}

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;

export async function embed(texts: string[]): Promise<number[][]> {
  const client = await getClient();
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
