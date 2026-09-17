import { describe, expect, it } from 'vitest';
import { CODEX_IMAGE_SIZES, nearestCodexSize, pngDimensions } from '../../image-engine/providers/codex-cli-provider';
import {
  buildCodexArgs,
  buildCodexInstruction,
  findLastAgentMessage,
  findThreadId,
  findUsage,
  isDoneMessage,
  isLoggedInOutput,
  parseCodexEvents,
  parseCodexVersion,
  pickHarvestedImage,
} from './codex-cli-protocol';

const THREAD = JSON.stringify({ type: 'thread.started', thread_id: '01a0ad95-0cf7-7641-915f-142c1f3a3a46' });
const STARTED = JSON.stringify({ type: 'turn.started' });
const MESSAGE = JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'DONE' } });
const REFUSED = JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'agent_message', text: "I can't create that image." } });
const COMPLETED = JSON.stringify({
  type: 'turn.completed',
  usage: { input_tokens: 37012, cached_input_tokens: 30208, cache_write_input_tokens: 0, output_tokens: 9, reasoning_output_tokens: 0 },
});

describe('parseCodexEvents', () => {
  it('parses JSONL and skips the stdin notice and broken lines (CRLF too)', () => {
    const events = parseCodexEvents(`Reading additional input from stdin...\r\n${THREAD}\r\n\r\n{broken\r\n${COMPLETED}\r\n`);
    expect(events.map((e) => e.type)).toEqual(['thread.started', 'turn.completed']);
  });
});

describe('findThreadId / findLastAgentMessage / findUsage', () => {
  const events = parseCodexEvents([THREAD, STARTED, REFUSED, MESSAGE, COMPLETED].join('\n'));

  it('reads the thread id from the first event — the harvest folder', () => {
    expect(findThreadId(events)).toBe('01a0ad95-0cf7-7641-915f-142c1f3a3a46');
    expect(findThreadId(parseCodexEvents(COMPLETED))).toBeNull();
  });

  it('takes the LAST agent message', () => {
    expect(findLastAgentMessage(events)).toBe('DONE');
    expect(findLastAgentMessage(parseCodexEvents(`${THREAD}\n${REFUSED}`))).toBe("I can't create that image.");
  });

  it('reads plan usage from turn.completed', () => {
    expect(findUsage(events)).toEqual({ inputTokens: 37012, cachedInputTokens: 30208, outputTokens: 9 });
    expect(findUsage(parseCodexEvents(THREAD))).toBeNull();
  });
});

describe('isDoneMessage', () => {
  it('accepts DONE with trailing punctuation or whitespace, nothing else', () => {
    expect(isDoneMessage('DONE')).toBe(true);
    expect(isDoneMessage('done.\n')).toBe(true);
    expect(isDoneMessage('The image is done')).toBe(false);
    expect(isDoneMessage(null)).toBe(false);
  });
});

describe('buildCodexInstruction', () => {
  it('pins the size, keeps the prompt verbatim, forbids commands and asks for DONE', () => {
    const text = buildCodexInstruction({ prompt: '  a clapperboard on a desk  ', size: CODEX_IMAGE_SIZES[1], referenceCount: 0 });
    expect(text).toContain('Size: 1536x1024 (landscape)');
    expect(text).toContain('<<<PROMPT\na clapperboard on a desk\nPROMPT');
    expect(text).toContain('Do not run any commands');
    expect(text.trim().endsWith('reply with exactly: DONE')).toBe(true);
    expect(text).not.toContain('attached image');
  });

  it('names the attached references as references', () => {
    expect(buildCodexInstruction({ prompt: 'p', size: CODEX_IMAGE_SIZES[0], referenceCount: 1 })).toContain('The 1 attached image is a visual reference');
    expect(buildCodexInstruction({ prompt: 'p', size: CODEX_IMAGE_SIZES[0], referenceCount: 2 })).toContain('The 2 attached images are visual references');
  });
});

describe('buildCodexArgs', () => {
  it('puts the prompt BEFORE -i (greedy) and the ephemeral flag before the prompt', () => {
    const args = buildCodexArgs({
      instruction: 'INSTR',
      cwd: 'C:\\tmp\\run',
      lastMessagePath: 'C:\\tmp\\run\\last.txt',
      referencePaths: ['C:\\tmp\\run\\ref-1.png', 'C:\\tmp\\run\\ref-2.jpg'],
      ephemeral: true,
    });
    expect(args).toEqual([
      'exec', '--skip-git-repo-check', '-s', 'read-only', '-C', 'C:\\tmp\\run',
      '-c', 'model_reasoning_effort=low', '--json', '-o', 'C:\\tmp\\run\\last.txt', '--ephemeral',
      'INSTR', '-i', 'C:\\tmp\\run\\ref-1.png', 'C:\\tmp\\run\\ref-2.jpg',
    ]);
  });

  it('omits -i and --ephemeral when unused', () => {
    const args = buildCodexArgs({ instruction: 'INSTR', cwd: 'd', lastMessagePath: 'd/last.txt', ephemeral: false });
    expect(args[args.length - 1]).toBe('INSTR');
    expect(args).not.toContain('--ephemeral');
    expect(args).not.toContain('-i');
  });
});

describe('pickHarvestedImage', () => {
  it('prefers exec-* images written after the start, newest first, and ignores older or non-image files', () => {
    const picked = pickHarvestedImage(
      [
        { name: 'exec-old.png', mtimeMs: 900 },
        { name: 'notes.txt', mtimeMs: 2000 },
        { name: 'other.png', mtimeMs: 2500 },
        { name: 'exec-1.png', mtimeMs: 2100 },
        { name: 'exec-2.PNG', mtimeMs: 2400 },
      ],
      1000,
    );
    expect(picked).toBe('exec-2.PNG');
    expect(pickHarvestedImage([{ name: 'exec-old.png', mtimeMs: 900 }], 1000)).toBeNull();
  });
});

describe('nearestCodexSize', () => {
  it('buckets a requested size onto the nearest of the three, square by default', () => {
    expect(nearestCodexSize(1920, 1080).label).toBe('1536x1024 (landscape)');
    expect(nearestCodexSize(1080, 1920).label).toBe('1024x1536 (portrait)');
    expect(nearestCodexSize(1000, 1100).label).toBe('1024x1024 (square)');
    expect(nearestCodexSize().label).toBe('1024x1024 (square)');
  });
});

describe('pngDimensions', () => {
  it('reads the IHDR width and height', () => {
    const buf = Buffer.alloc(33, 0);
    buf.writeUInt32BE(0x89504e47, 0);
    buf.writeUInt32BE(1254, 16);
    buf.writeUInt32BE(1254, 20);
    expect(pngDimensions(buf)).toEqual({ width: 1254, height: 1254 });
    expect(pngDimensions(Buffer.from('/9j/', 'base64'))).toBeNull();
  });
});

describe('probe parsing', () => {
  it('extracts the version and recognises a signed-in status', () => {
    expect(parseCodexVersion('codex-cli 0.154.0\n')).toBe('0.154.0');
    expect(isLoggedInOutput('Logged in using ChatGPT\n', '')).toBe(true);
    expect(isLoggedInOutput('Not logged in\n', '')).toBe(false);
  });
});
