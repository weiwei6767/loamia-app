type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type TextBlock = { type: "text"; text: string };
type ContentBlock = ImageBlock | TextBlock;

type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type CreateResponse = {
  content: { type: string; text?: string }[];
};

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
    create(args: {
      model: string;
      max_tokens: number;
      messages: Message[];
    }): Promise<CreateResponse>;
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
