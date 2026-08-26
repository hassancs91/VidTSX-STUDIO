import { describe, expect, it } from 'vitest';
import {
  parseAgyEvents,
  findConversationId,
  isGenerateImageDone,
  findAgentResponse,
  buildAgyInstruction,
  pickHarvestedImage,
} from './agy-cli-protocol';

const INIT_LINE = JSON.stringify({ event: 'init', conversation_id: 'conv-abc123' });
const DONE_LINE = JSON.stringify({
  event: 'step_update',
  step_update: { tool_name: 'generate_image', state: 'DONE' },
});
const RESULT_LINE = JSON.stringify({
  event: 'result',
  result: { response: 'I cannot create that image.' },
});

describe('parseAgyEvents', () => {
  it('parses NDJSON lines and tolerates blank lines and non-JSON noise', () => {
    const stdout = `\n${INIT_LINE}\nsome plain-text warning\n\n${DONE_LINE}\n{broken json\n`;
    const events = parseAgyEvents(stdout);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('init');
    expect(events[1].event).toBe('step_update');
  });

  it('handles CRLF line endings (agy on Windows)', () => {
    const events = parseAgyEvents(`${INIT_LINE}\r\n${DONE_LINE}\r\n`);
    expect(events).toHaveLength(2);
  });
});

describe('findConversationId', () => {
  it('reads conversation_id as a SIBLING of the init event', () => {
    const events = parseAgyEvents(`${INIT_LINE}\n${DONE_LINE}`);
    expect(findConversationId(events)).toBe('conv-abc123');
  });

  it('returns null when no init event exists', () => {
    expect(findConversationId(parseAgyEvents(DONE_LINE))).toBeNull();
  });
});

describe('isGenerateImageDone', () => {
  it('requires a DONE generate_image step — exit code 0 alone means nothing', () => {
    expect(isGenerateImageDone(parseAgyEvents(`${INIT_LINE}\n${DONE_LINE}`))).toBe(true);
  });

  it('is false for a soft-denied run (init + result, no DONE step)', () => {
    expect(isGenerateImageDone(parseAgyEvents(`${INIT_LINE}\n${RESULT_LINE}`))).toBe(false);
  });

  it('is false for another tool reaching DONE', () => {
    const other = JSON.stringify({
      event: 'step_update',
      step_update: { tool_name: 'run_command', state: 'DONE' },
    });
    expect(isGenerateImageDone(parseAgyEvents(other))).toBe(false);
  });

  it('is false for generate_image in a non-DONE state', () => {
    const running = JSON.stringify({
      event: 'step_update',
      step_update: { tool_name: 'generate_image', state: 'RUNNING' },
    });
    expect(isGenerateImageDone(parseAgyEvents(running))).toBe(false);
  });
});

describe('findAgentResponse', () => {
  it('surfaces the agent final text for refusal errors', () => {
    const events = parseAgyEvents(`${INIT_LINE}\n${RESULT_LINE}`);
    expect(findAgentResponse(events)).toBe('I cannot create that image.');
  });

  it('returns null without a result event', () => {
    expect(findAgentResponse(parseAgyEvents(INIT_LINE))).toBeNull();
  });
});

describe('buildAgyInstruction', () => {
  it('pins the prompt VERBATIM inside the heredoc fences', () => {
    const instruction = buildAgyInstruction({
      prompt: '  a red bicycle, no text, full-bleed  ',
      imageName: 'shot_01',
    });
    expect(instruction).toContain('use the following text VERBATIM as the Prompt parameter');
    expect(instruction).toContain('<<<PROMPT\na red bicycle, no text, full-bleed\nPROMPT');
    expect(instruction).toContain('ImageName: shot_01');
    expect(instruction).toContain('Call the generate_image tool EXACTLY ONCE');
    // No refs, no aspect → those sections stay absent (the closing guardrail
    // sentence still mentions ImagePaths, so match the section header).
    expect(instruction).not.toContain('AspectRatio:');
    expect(instruction).not.toContain('ImagePaths (use these exact absolute paths');
  });

  it('includes aspect and reference paths in order when given', () => {
    const instruction = buildAgyInstruction({
      prompt: 'p',
      imageName: 'n',
      aspect: '4:5',
      referencePaths: ['C:\\refs\\hero.jpg', 'C:\\refs\\room.png'],
    });
    expect(instruction).toContain('AspectRatio: 4:5');
    const heroIdx = instruction.indexOf('C:\\refs\\hero.jpg');
    const roomIdx = instruction.indexOf('C:\\refs\\room.png');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(roomIdx).toBeGreaterThan(heroIdx);
    // The don't-touch-files guardrails ride along.
    expect(instruction).toContain('Do not copy, move or rename any files.');
  });
});

describe('pickHarvestedImage', () => {
  it('picks the newest image file', () => {
    const picked = pickHarvestedImage([
      { name: 'older.jpg', mtimeMs: 1000 },
      { name: 'newest.png', mtimeMs: 3000 },
      { name: 'middle.webp', mtimeMs: 2000 },
    ]);
    expect(picked).toBe('newest.png');
  });

  it('ignores non-image files (metadata, logs)', () => {
    const picked = pickHarvestedImage([
      { name: 'notes.json', mtimeMs: 9000 },
      { name: 'trace.log', mtimeMs: 8000 },
      { name: 'out.jpeg', mtimeMs: 100 },
    ]);
    expect(picked).toBe('out.jpeg');
  });

  it('returns null when nothing harvestable exists', () => {
    expect(pickHarvestedImage([{ name: 'notes.json', mtimeMs: 1 }])).toBeNull();
    expect(pickHarvestedImage([])).toBeNull();
  });
});
