import { describe, expect, it } from 'vitest';
import { createProtocolParser, parseProtocolLine } from './protocol-parser';
import type { PythonProtocolEvent } from './types';

describe('parseProtocolLine', () => {
  it('parses every event type the runners emit', () => {
    expect(parseProtocolLine('{"type":"ready","torch":"2.14.0+cu126","cuda":true,"device":"NVIDIA GeForce GTX 1650 Ti","vramMb":4095,"python":"3.11.15","importSeconds":3.1}'))
      .toEqual({ type: 'ready', torch: '2.14.0+cu126', cuda: true, device: 'NVIDIA GeForce GTX 1650 Ti', vramMb: 4095, python: '3.11.15', importSeconds: 3.1 });
    // rembg: no torch, onnxruntime providers instead
    expect(parseProtocolLine('{"type":"ready","torch":null,"cuda":false,"device":"cpu","vramMb":0,"onnxruntime":"1.29.0","providers":["CPUExecutionProvider"]}'))
      .toMatchObject({ type: 'ready', torch: null, cuda: false, device: 'cpu', onnxruntime: '1.29.0', providers: ['CPUExecutionProvider'] });
    expect(parseProtocolLine('{"type":"stage","name":"load-model"}')).toEqual({ type: 'stage', name: 'load-model' });
    expect(parseProtocolLine('{"type":"progress","stage":"shape","pct":42}')).toEqual({ type: 'progress', stage: 'shape', pct: 42 });
    expect(parseProtocolLine('{"type":"result","outputPath":"C:\\\\out\\\\mesh.glb","stats":{"vertices":41864}}'))
      .toEqual({ type: 'result', outputPath: 'C:\\out\\mesh.glb', stats: { vertices: 41864 } });
    expect(parseProtocolLine('{"type":"result","outputPath":null,"stats":{"warmup":true}}'))
      .toEqual({ type: 'result', outputPath: null, stats: { warmup: true } });
    expect(parseProtocolLine('{"type":"error","code":"oom","message":"Ran out of memory (GPU)."}'))
      .toEqual({ type: 'error', code: 'oom', message: 'Ran out of memory (GPU).' });
  });

  it('normalises odd values instead of throwing', () => {
    expect(parseProtocolLine('{"type":"progress","stage":"shape","pct":140}')).toEqual({ type: 'progress', stage: 'shape', pct: 100 });
    expect(parseProtocolLine('{"type":"progress","stage":"shape","pct":"x"}')).toBeNull();
    expect(parseProtocolLine('{"type":"error","code":"made-up","message":"m"}')).toEqual({ type: 'error', code: 'unknown', message: 'm' });
    expect(parseProtocolLine('{"type":"error","code":"oom"}')).toMatchObject({ type: 'error', code: 'oom' });
    expect(parseProtocolLine('{"type":"stage"}')).toBeNull();
    expect(parseProtocolLine('{"type":"result"}')).toEqual({ type: 'result', outputPath: null, stats: {} });
  });

  it('ignores anything that is not a protocol object', () => {
    expect(parseProtocolLine('')).toBeNull();
    expect(parseProtocolLine('Loading model…')).toBeNull();
    expect(parseProtocolLine('{not json')).toBeNull();
    expect(parseProtocolLine('[1,2]')).toBeNull();
    expect(parseProtocolLine('{"type":"telemetry"}')).toBeNull();
    expect(parseProtocolLine('{"foo":"bar"}')).toBeNull();
  });
});

describe('createProtocolParser', () => {
  function collect(chunks: string[], flush = true): PythonProtocolEvent[] {
    const out: PythonProtocolEvent[] = [];
    const p = createProtocolParser((e) => out.push(e));
    for (const c of chunks) p.push(c);
    if (flush) p.flush();
    return out;
  }

  it('reassembles a line split across chunks and splits several lines in one chunk', () => {
    const events = collect([
      '{"type":"stage","na',
      'me":"load-model"}\n{"type":"progress","stage":"shape","pct":10}\n{"type":"prog',
      'ress","stage":"shape","pct":20}\n',
    ]);
    expect(events).toEqual([
      { type: 'stage', name: 'load-model' },
      { type: 'progress', stage: 'shape', pct: 10 },
      { type: 'progress', stage: 'shape', pct: 20 },
    ]);
  });

  it('drops noise lines between events', () => {
    const events = collect(['print from a library\n{"type":"stage","name":"process"}\n\r\n{oops\n']);
    expect(events).toEqual([{ type: 'stage', name: 'process' }]);
  });

  it('flush() delivers a final line without a newline; without flush it stays buffered', () => {
    expect(collect(['{"type":"result","outputPath":"x","stats":{}}'], false)).toEqual([]);
    expect(collect(['{"type":"result","outputPath":"x","stats":{}}'])).toEqual([{ type: 'result', outputPath: 'x', stats: {} }]);
  });

  it('handles CRLF endings', () => {
    expect(collect(['{"type":"stage","name":"a"}\r\n{"type":"stage","name":"b"}\r\n'])).toEqual([
      { type: 'stage', name: 'a' },
      { type: 'stage', name: 'b' },
    ]);
  });
});
