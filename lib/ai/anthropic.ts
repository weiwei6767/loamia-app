type AnthropicClient = {
  messages: {
    stream(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): AsyncIterable<{
      type: string;
      delta?: { type: string; text?: string };
      [k: string]: unknown;
    }>;
  };
};

let _client: AnthropicClient | null = null;
export async function anthropic(): Promise<AnthropicClient> {
  if (!_client) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }) as unknown as AnthropicClient;
  }
  return _client;
}

export const CHAT_MODEL = "claude-sonnet-4-6";
