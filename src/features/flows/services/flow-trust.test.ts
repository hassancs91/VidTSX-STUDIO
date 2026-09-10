// The trust tag on a flow card / details (flows plan §1.7, W8 Stage 6):
// built-in outranks the signature; the agents' three states otherwise.

import { describe, it, expect } from 'vitest';
import { trustTagForFlow } from './flow-trust';

const pkg = (signature: 'verified' | 'signed-unknown' | 'unsigned', publisher?: string) => ({
  version: '1.0.0',
  author: 'Acme',
  signature,
  ...(publisher ? { publisher } : {}),
});

describe('trustTagForFlow', () => {
  it('a built-in says Built-in even though its folder is unsigned', () => {
    expect(trustTagForFlow({ source: 'builtin', package: pkg('unsigned') })).toMatchObject({ id: 'builtin', label: 'Built-in', tone: 'accent' });
  });

  it('an installed flow carries the three signature states', () => {
    expect(trustTagForFlow({ source: 'installed', package: pkg('verified', 'VidTSX') })).toMatchObject({ id: 'verified', label: 'Verified by VidTSX', tone: 'accent' });
    expect(trustTagForFlow({ source: 'installed', package: pkg('signed-unknown') })).toMatchObject({ id: 'signed-unknown', label: 'Signed, unverified publisher', tone: 'warning' });
    expect(trustTagForFlow({ source: 'installed', package: pkg('unsigned') })).toMatchObject({ id: 'unsigned', label: 'Unsigned', tone: 'warning' });
    expect(trustTagForFlow({ source: 'installed', package: pkg('unsigned') }).notice).toMatch(/not reviewed/);
  });

  it('a user flow has no tag', () => {
    expect(trustTagForFlow({ source: 'user' })).toMatchObject({ id: 'none', tone: 'muted' });
  });
});
