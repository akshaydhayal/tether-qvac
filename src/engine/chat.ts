/**
 * Chat Engine
 * Wraps @qvac/sdk completion() for LLM conversation with streaming token output.
 *
 * SDK CompletionClientParams shape:
 *   - history: { role: string; content: string }[]  ← NOT "messages"
 *   - modelId: string
 *   - stream: boolean
 *   - generationParams.predict: number              ← NOT "maxTokens"
 *
 * CompletionRun shape:
 *   - tokenStream: AsyncGenerator<string>   ← iterate this for streaming
 *   - stats: Promise<CompletionStats>       ← { tokensPerSecond, generatedTokens }
 */
import { completion } from '@qvac/sdk';
import { getModelId } from './qvac.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStats {
  tokensPerSecond: number;
  totalTokens: number;
  latencyMs: number;
}

export interface StreamChatOptions {
  systemPrompt?: string;
  onToken: (token: string) => void;
  onDone: (fullText: string, stats?: ChatStats) => void;
  maxTokens?: number;
}

/**
 * Stream a chat response token-by-token.
 * System prompt is prepended as a { role: 'system', content } history entry.
 */
export async function streamChat(
  history: ChatMessage[],
  opts: StreamChatOptions
): Promise<void> {
  const modelId = getModelId('llm');
  const startMs = Date.now();

  // SDK uses `history` (not `messages`), and system prompt is just another history entry
  const sdkHistory: { role: string; content: string }[] = [];
  if (opts.systemPrompt) {
    sdkHistory.push({ role: 'system', content: opts.systemPrompt });
  }
  for (const m of history) {
    sdkHistory.push({ role: m.role, content: m.content });
  }

  // completion() returns a CompletionRun — NOT an async iterable itself
  const run = completion({
    modelId,
    history: sdkHistory,
    stream: true,
    generationParams: {
      predict: opts.maxTokens ?? 2048,
    },
  });

  let fullText = '';

  // tokenStream is the correct AsyncGenerator<string> streaming surface
  for await (const token of run.tokenStream) {
    if (token) {
      fullText += token;
      opts.onToken(token);
    }
  }

  // Await SDK stats after stream ends
  const sdkStats = await run.stats;
  const latencyMs = Date.now() - startMs;

  const stats: ChatStats = {
    tokensPerSecond: sdkStats?.tokensPerSecond ?? 0,
    totalTokens: sdkStats?.generatedTokens ?? fullText.split(' ').length,
    latencyMs,
  };

  opts.onDone(fullText, stats);
}

/**
 * One-shot (non-streaming) chat completion — useful for CLI commands.
 */
export async function chatOnce(
  history: ChatMessage[],
  systemPrompt?: string
): Promise<{ text: string; stats: ChatStats }> {
  return new Promise((resolve, reject) => {
    streamChat(history, {
      systemPrompt,
      onToken: () => {},
      onDone: (text, stats) =>
        resolve({
          text,
          stats: stats ?? { tokensPerSecond: 0, totalTokens: 0, latencyMs: 0 },
        }),
    }).catch(reject);
  });
}
