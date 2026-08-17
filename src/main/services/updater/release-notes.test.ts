import { describe, expect, it } from 'vitest';
import type { UpdateInfo } from 'electron-updater';
import { normalizeReleaseNotes } from './release-notes';

function info(releaseNotes: UpdateInfo['releaseNotes']): UpdateInfo {
  return { releaseNotes } as UpdateInfo;
}

// The exact shape the GitHub provider delivered during the 2026-08-17 E2E test:
// the release body markdown converted to HTML.
const GITHUB_HTML = `<h2>What's new in 0.9.2</h2>
<p><strong>E2E test round</strong> for the install-on-quit path.</p>
<ul>
<li>Verifies the <em>one toast</em> rule</li>
<li>Verifies <code>Updating… N%</code> chip</li>
<li><a href="https://example.com" rel="nofollow">Link rendering test</a></li>
</ul>`;

describe('normalizeReleaseNotes', () => {
  it('returns null for missing notes', () => {
    expect(normalizeReleaseNotes(info(null))).toBeNull();
    expect(normalizeReleaseNotes(info(undefined))).toBeNull();
    expect(normalizeReleaseNotes(info(''))).toBeNull();
  });

  it('passes plain markdown through untouched', () => {
    const md = '## 0.9.2\n\n- fixed a thing\n- `code` and **bold**';
    expect(normalizeReleaseNotes(info(md))).toBe(md);
  });

  it('converts the GitHub-provider HTML shape back to markdown', () => {
    const result = normalizeReleaseNotes(info(GITHUB_HTML));
    expect(result).toBe(
      [
        "## What's new in 0.9.2",
        '',
        '**E2E test round** for the install-on-quit path.',
        '',
        '- Verifies the *one toast* rule',
        '- Verifies `Updating… N%` chip',
        '- [Link rendering test](https://example.com)',
      ].join('\n'),
    );
  });

  it('never leaks raw tags for the common GitHub tag set', () => {
    const html =
      '<h1>Title</h1><p>Para with <b>bold</b>, <i>italic</i> and <br>a break.</p>' +
      '<hr><blockquote>quoted<br>lines</blockquote><ol><li>first</li><li>second</li></ol>' +
      '<img src="x.png" alt="screenshot"><div><span>loose</span></div>';
    const result = normalizeReleaseNotes(info(html))!;
    expect(result).not.toMatch(/<[^>]+>/);
    expect(result).toContain('# Title');
    expect(result).toContain('**bold**');
    expect(result).toContain('*italic*');
    expect(result).toContain('---');
    expect(result).toContain('> quoted');
    expect(result).toContain('1. first');
    expect(result).toContain('2. second');
    expect(result).toContain('screenshot');
  });

  it('preserves code blocks verbatim, entities decoded, without markdown processing', () => {
    const html = '<p>Run:</p><pre><code>npm install &amp;&amp; npm run dev\n// &lt;not a tag&gt;</code></pre>';
    const result = normalizeReleaseNotes(info(html))!;
    expect(result).toContain('```\nnpm install && npm run dev\n// <not a tag>\n```');
  });

  it('decodes entities outside code without double-unescaping', () => {
    const result = normalizeReleaseNotes(info('<p>a &lt; b &amp;&amp; c &gt; d &amp;amp; &quot;quoted&quot;</p>'))!;
    expect(result).toBe('a < b && c > d &amp; "quoted"');
  });

  it('normalizes per-version note arrays, converting HTML entries', () => {
    const result = normalizeReleaseNotes(
      info([
        { version: '0.9.2', note: '<p><strong>bold</strong> note</p>' },
        { version: '0.9.1', note: 'plain note' },
        { version: '0.9.0', note: null },
      ]),
    );
    expect(result).toBe('## 0.9.2\n\n**bold** note\n\n## 0.9.1\n\nplain note\n\n## 0.9.0\n\n');
  });

  it('returns null when every entry is empty', () => {
    expect(normalizeReleaseNotes(info([{ version: undefined as unknown as string, note: null }]))).toBeNull();
  });
});
