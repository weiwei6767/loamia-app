type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type TextBlock = { type: "text"; text: string };
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };
type ContentBlock = ImageBlock | TextBlock | ToolUseBlock | ToolResultBlock;

type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type CreateResponse = {
  content: ContentBlock[];
  stop_reason?: string | null;
};

type ToolDef = {
  name: string;
  description: string;
  input_schema: unknown;
};

type StreamEvent = {
  type: string;
  index?: number;
  content_block?: { type: string; id?: string; name?: string; text?: string; input?: unknown };
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  [k: string]: unknown;
};

type Stream = AsyncIterable<StreamEvent> & {
  finalMessage(): Promise<{
    content: ContentBlock[];
    stop_reason: string | null;
  }>;
};

type AnthropicClient = {
  messages: {
    stream(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Message[];
      tools?: ToolDef[];
    }): Stream;
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Message[];
      tools?: ToolDef[];
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
