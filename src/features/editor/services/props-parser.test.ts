import { describe, it, expect } from 'vitest';
import { extractComponentProps } from './props-parser';

describe('extractComponentProps', () => {
  it('extracts destructured defaults typed by an interface', async () => {
    const props = await extractComponentProps(`
      import React from 'react';
      interface Props { title?: string; count?: number; active?: boolean; }
      export default function Demo({ title = 'Hello', count = 3, active = true }: Props) {
        return <div>{title}{count}{active}</div>;
      }
    `);
    expect(props).toEqual([
      { name: 'title', control: 'text', defaultValue: 'Hello' },
      { name: 'count', control: 'number', defaultValue: 3 },
      { name: 'active', control: 'boolean', defaultValue: true },
    ]);
  });

  it('extracts from an inline type literal', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ speed = 1.5 }: { speed?: number }) { return null; }
    `);
    expect(props).toEqual([{ name: 'speed', control: 'number', defaultValue: 1.5 }]);
  });

  it('detects colors by prop name', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ bgColor = 'red', stroke = 'blue' }: { bgColor?: string; stroke?: string }) {
        return null;
      }
    `);
    expect(props.map((p) => p.control)).toEqual(['color', 'color']);
  });

  it('detects colors by hex default even without a color-ish name', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ accent = '#ff00aa' }) { return null; }
    `);
    expect(props).toEqual([{ name: 'accent', control: 'color', defaultValue: '#ff00aa' }]);
  });

  it('maps string-literal unions to select with options', async () => {
    const props = await extractComponentProps(`
      type Props = { direction?: 'left' | 'right' | 'up' };
      export default function Demo({ direction = 'left' }: Props) { return null; }
    `);
    expect(props).toEqual([
      { name: 'direction', control: 'select', defaultValue: 'left', options: ['left', 'right', 'up'] },
    ]);
  });

  it('resolves an arrow function exported by identifier', async () => {
    const props = await extractComponentProps(`
      const Demo = ({ label = 'x' }: { label?: string }) => null;
      export default Demo;
    `);
    expect(props).toEqual([{ name: 'label', control: 'text', defaultValue: 'x' }]);
  });

  it('extracts type members for an un-destructured props parameter', async () => {
    const props = await extractComponentProps(`
      interface Props { size: number; label: string; }
      export default function Demo(props: Props) { return null; }
    `);
    expect(props).toEqual([
      { name: 'size', control: 'number', defaultValue: null },
      { name: 'label', control: 'text', defaultValue: null },
    ]);
  });

  it('uses the source prop name for renamed destructured bindings', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ color: main = '#ffffff' }) { return null; }
    `);
    expect(props).toEqual([{ name: 'color', control: 'color', defaultValue: '#ffffff' }]);
  });

  it('handles negative numeric defaults', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ offset = -10 }: { offset?: number }) { return null; }
    `);
    expect(props).toEqual([{ name: 'offset', control: 'number', defaultValue: -10 }]);
  });

  it('skips props with non-primitive types or defaults', async () => {
    const props = await extractComponentProps(`
      interface Props { items?: string[]; onClick?: () => void; style?: object; label?: string; }
      export default function Demo({ items = [], onClick, style = {}, label = 'ok' }: Props) {
        return null;
      }
    `);
    expect(props).toEqual([{ name: 'label', control: 'text', defaultValue: 'ok' }]);
  });

  it('skips rest elements', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ title = 't', ...rest }: { title?: string }) { return null; }
    `);
    expect(props).toEqual([{ name: 'title', control: 'text', defaultValue: 't' }]);
  });

  it('returns empty for a component with no parameters', async () => {
    const props = await extractComponentProps(`
      export default function Demo() { return null; }
    `);
    expect(props).toEqual([]);
  });

  it('returns empty when there is no default export', async () => {
    const props = await extractComponentProps(`
      export function Demo({ title = 'x' }: { title?: string }) { return null; }
    `);
    expect(props).toEqual([]);
  });

  it('returns empty for empty or whitespace source', async () => {
    expect(await extractComponentProps('')).toEqual([]);
    expect(await extractComponentProps('   \n  ')).toEqual([]);
  });

  it('tolerates syntax errors without throwing', async () => {
    const props = await extractComponentProps(`
      export default function Demo({ title = 'x' }: { title?: string }) {
        return <div>{title
    `);
    expect(props).toEqual([{ name: 'title', control: 'text', defaultValue: 'x' }]);
  });
});
