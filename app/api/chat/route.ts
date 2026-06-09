import { NextRequest } from 'next/server';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { TOOL_DEFS, executeTool, summarizeToolResult, type ToolPayload } from '@/lib/ai/tools';
import type { Locale } from '@/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCallSerialized[];
  name?: string;
};

type ToolCallSerialized = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type DeepSeekStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
};

/**
 * Streaming chat endpoint. Wire protocol on the response body is newline-
 * delimited JSON ("NDJSON"), one event per line:
 *
 *   {"t":"d","v":"text delta"}
 *   {"t":"tool","name":"search_projects","data":{...}}
 *   {"t":"err","message":"..."}
 *
 * The client (components/chat/chat-room.tsx) accumulates text deltas into the
 * assistant message draft and renders any tool events as inline rich cards.
 */
export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; locale?: Locale } = {};
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const userMessages = (body.messages ?? []).filter((m) => m.role !== 'system');
  if (userMessages.length === 0) return new Response('Empty conversation', { status: 400 });

  const locale: Locale = body.locale === 'en' ? 'en' : 'zh';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    const mock =
      locale === 'zh'
        ? '（演示模式）请在 .env.local 配置 DEEPSEEK_API_KEY 后再试。\n\n示例回答：他的核心方向是大模型机器遗忘学习与多智能体架构。'
        : '(Demo mode) Set DEEPSEEK_API_KEY in .env.local to enable live answers.\n\nExample: His focus is LLM machine unlearning and multi-agent orchestration.';
    return ndjsonResponse(streamMockText(mock));
  }

  const systemPrompt = await buildSystemPrompt(locale);
  const initial: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ];

  const stream = runChatLoop({
    messages: initial,
    locale,
    baseUrl,
    apiKey,
    model,
  });

  return ndjsonResponse(stream);
}

// ──────────────────────────────────────────────────────────────────────────────
// Stream helpers
// ──────────────────────────────────────────────────────────────────────────────

type ChatEvent =
  | { t: 'd'; v: string }
  | { t: 'tool'; name: string; data: ToolPayload }
  | { t: 'err'; message: string };

function ndjsonResponse(events: AsyncIterable<ChatEvent>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of events) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(JSON.stringify({ t: 'err', message }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function* streamMockText(text: string): AsyncGenerator<ChatEvent> {
  const chunks = text.match(/.{1,8}/gs) ?? [text];
  for (const c of chunks) {
    yield { t: 'd', v: c };
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat loop with tool calling
// ──────────────────────────────────────────────────────────────────────────────

type LoopOpts = {
  messages: ChatMessage[];
  locale: Locale;
  baseUrl: string;
  apiKey: string;
  model: string;
};

const MAX_TOOL_ROUNDS = 3;

async function* runChatLoop(opts: LoopOpts): AsyncGenerator<ChatEvent> {
  const { messages, locale, baseUrl, apiKey, model } = opts;
  const history: ChatMessage[] = [...messages];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const collected: {
      content: string;
      toolCalls: Map<number, { id: string; name: string; args: string }>;
    } = {
      content: '',
      toolCalls: new Map(),
    };

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const reqBody = {
      model,
      stream: true,
      temperature: 0.6,
      messages: history.map(serializeMessage),
      tools: round < MAX_TOOL_ROUNDS ? TOOL_DEFS.map(asOpenAITool) : undefined,
      tool_choice: round < MAX_TOOL_ROUNDS ? 'auto' : 'none',
    };
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(reqBody),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      yield {
        t: 'err',
        message: `Upstream error ${upstream.status}: ${text.slice(0, 200)}`,
      };
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });

      let nlIdx;
      while ((nlIdx = buffered.indexOf('\n\n')) >= 0) {
        const event = buffered.slice(0, nlIdx).trim();
        buffered = buffered.slice(nlIdx + 2);
        if (!event) continue;
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            // wrap-up handled below
            continue;
          }
          let parsed: DeepSeekStreamChunk;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          const delta = parsed?.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            collected.content += delta.content;
            yield { t: 'd', v: delta.content };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const index = typeof tc.index === 'number' ? tc.index : 0;
              const cur = collected.toolCalls.get(index) ?? {
                id: '',
                name: '',
                args: '',
              };
              if (typeof tc.id === 'string' && tc.id) cur.id = tc.id;
              if (typeof tc.function?.name === 'string' && tc.function.name)
                cur.name = tc.function.name;
              if (typeof tc.function?.arguments === 'string')
                cur.args += tc.function.arguments;
              collected.toolCalls.set(index, cur);
            }
          }
        }
      }
    }

    // No tool calls -> we're done.
    if (collected.toolCalls.size === 0) {
      return;
    }

    // Append the assistant turn (content + tool_calls) to history and execute
    // each tool. The tool result becomes a `tool` role message; the model gets
    // another chance to produce a final answer next round.
    const serializedCalls: ToolCallSerialized[] = Array.from(collected.toolCalls.values()).map(
      (c, i) => ({
        id: c.id || `call_${round}_${i}`,
        type: 'function',
        function: { name: c.name, arguments: c.args || '{}' },
      }),
    );
    history.push({
      role: 'assistant',
      content: collected.content,
      tool_calls: serializedCalls,
    });

    for (const call of serializedCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }
      const result = await executeTool(call.function.name, parsedArgs, { locale });
      yield { t: 'tool', name: call.function.name, data: result };
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: summarizeToolResult(result),
      });
    }
    // continue loop for the next assistant turn
  }
}

function serializeMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'assistant' && m.tool_calls?.length) {
    return {
      role: 'assistant',
      content: m.content ?? '',
      tool_calls: m.tool_calls,
    };
  }
  if (m.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: m.tool_call_id,
      name: m.name,
      content: m.content,
    };
  }
  return { role: m.role, content: m.content };
}

function asOpenAITool(def: typeof TOOL_DEFS[number]) {
  return {
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  };
}
