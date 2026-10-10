import type { LLMTurnUsage } from "../types";

// Per-API-response usage from the Agent SDK message stream (LLMRequest.onTurn).
//
// The SDK's `assistant` messages are not one per API response: while a
// response streams, the CLI emits one assistant message per content block,
// several sharing `message.id`, and their `usage` is not final (SDK 0.3.286
// docs; P0 run 2 saw 61 assistant messages for 46 API turns). The exact
// numbers are in the raw stream events (includePartialMessages):
// `message_start` carries the input side, `message_delta` the final output
// count, and a response is complete at its `message_delta`.
//
// Fallback: a response seen only through assistant messages (a hot session
// created without partial messages) is reported once, with the largest value
// of each field across its messages, when the next response starts or the
// request ends — late and approximate, but never silent.

/** The SDK usage fields, snake_case as they come off the wire. */
interface WireUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

interface StreamEventLike {
  type?: string;
  message?: { id?: string; usage?: WireUsage };
  usage?: WireUsage;
}

interface OpenTurn {
  id: string;
  usage: LLMTurnUsage;
  fromStream: boolean;
  reported: boolean;
}

function readUsage(turn: number, wire: WireUsage | undefined): LLMTurnUsage {
  return {
    turn,
    inputTokens: wire?.input_tokens ?? 0,
    outputTokens: wire?.output_tokens ?? 0,
    cacheReadInputTokens: wire?.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: wire?.cache_creation_input_tokens ?? 0,
  };
}

export class TurnUsageTracker {
  private turn = 0;
  private open: OpenTurn | null = null;
  private seen = new Set<string>();

  constructor(private readonly emit: (usage: LLMTurnUsage) => void) {}

  /** A raw stream event (`stream_event` message's `event`). */
  streamEvent(event: StreamEventLike | undefined): void {
    if (event?.type === "message_start" && event.message?.id) {
      this.begin(event.message.id, event.message.usage, true);
    } else if (event?.type === "message_delta" && this.open?.fromStream && !this.open.reported) {
      // Delta counts are cumulative for the response; null = unchanged.
      const u = event.usage;
      const usage = this.open.usage;
      if (u?.output_tokens != null) usage.outputTokens = u.output_tokens;
      if (u?.input_tokens != null) usage.inputTokens = u.input_tokens;
      if (u?.cache_read_input_tokens != null) usage.cacheReadInputTokens = u.cache_read_input_tokens;
      if (u?.cache_creation_input_tokens != null) usage.cacheCreationInputTokens = u.cache_creation_input_tokens;
      this.report();
    }
  }

  /** A complete `assistant` message — counted only when the stream did not. */
  assistant(message: { id?: string; usage?: WireUsage } | undefined): void {
    const id = message?.id;
    if (!id) return;
    if (!this.seen.has(id)) {
      this.begin(id, message.usage, false);
      return;
    }
    const open = this.open;
    if (open && open.id === id && !open.fromStream) {
      const next = readUsage(open.usage.turn, message.usage);
      open.usage.inputTokens = Math.max(open.usage.inputTokens, next.inputTokens);
      open.usage.outputTokens = Math.max(open.usage.outputTokens, next.outputTokens);
      open.usage.cacheReadInputTokens = Math.max(open.usage.cacheReadInputTokens, next.cacheReadInputTokens);
      open.usage.cacheCreationInputTokens = Math.max(open.usage.cacheCreationInputTokens, next.cacheCreationInputTokens);
    }
  }

  /** The request ended: report a fallback turn still open. */
  flush(): void {
    if (this.open && !this.open.reported) this.report();
  }

  /** Start counting from turn 1 again (the next request on a hot session). */
  reset(): void {
    this.turn = 0;
    this.open = null;
    this.seen.clear();
  }

  private begin(id: string, wire: WireUsage | undefined, fromStream: boolean): void {
    this.flush();
    this.turn += 1;
    this.seen.add(id);
    this.open = { id, usage: readUsage(this.turn, wire), fromStream, reported: false };
  }

  private report(): void {
    const open = this.open!;
    open.reported = true;
    try {
      this.emit({ ...open.usage });
    } catch {
      /* caller callback errors must not break the message loop */
    }
  }
}
