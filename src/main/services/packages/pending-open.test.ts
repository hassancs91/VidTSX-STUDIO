// The file-association hand-off: what counts as a package path on argv, and
// the one-shot claim that stops two windows importing the same file — now for
// two extensions, so the claim is scoped by kind (agents plan §1.6).
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingPackage,
  hasPendingPackage,
  packageFromArgv,
  packageKindFor,
  setPendingPackage,
  takePendingPackage,
} from './pending-open';

beforeEach(() => {
  clearPendingPackage();
});

describe('packageFromArgv', () => {
  it('finds the package however the OS orders the argv', () => {
    expect(packageFromArgv(['electron.exe', 'C:\\videos\\promo.vidtsx'])).toEqual({
      kind: 'project',
      filePath: 'C:\\videos\\promo.vidtsx',
    });
    expect(
      packageFromArgv(['app.exe', '--allow-file-access', 'D:\\hand-offs\\cut 2.vidtsx']),
    ).toEqual({ kind: 'project', filePath: 'D:\\hand-offs\\cut 2.vidtsx' });
    expect(packageFromArgv(['app.exe', '/home/h/promo.VIDTSX'])).toEqual({
      kind: 'project',
      filePath: '/home/h/promo.VIDTSX',
    });
  });

  it('recognises a flow package as its own kind (W8 Stage 6)', () => {
    expect(packageFromArgv(['app.exe', 'C:\dl\vidtsx.thumbnail.vidtsxflow'])).toEqual({
      kind: 'flow',
      filePath: 'C:\dl\vidtsx.thumbnail.vidtsxflow',
    });
    expect(packageKindFor('/tmp/a.VIDTSXFLOW')).toBe('flow');
    setPendingPackage({ kind: 'flow', filePath: 'C:\dl\a.vidtsxflow' });
    expect(takePendingPackage('agent')).toBeNull();
    expect(takePendingPackage('project')).toBeNull();
    expect(hasPendingPackage('flow')).toBe(true);
    expect(takePendingPackage('flow')).toBe('C:\dl\a.vidtsxflow');
    expect(hasPendingPackage()).toBe(false);
  });

  it('recognises a template package as its own kind (templates plan §7)', () => {
    expect(packageFromArgv(['app.exe', '--flag', 'D:/dl/acme.count.vidtsxtemplate'])).toEqual({
      kind: 'template',
      filePath: 'D:/dl/acme.count.vidtsxtemplate',
    });
    expect(packageKindFor('/tmp/a.VidTSXTemplate')).toBe('template');
    setPendingPackage({ kind: 'template', filePath: 'D:/dl/a.vidtsxtemplate' });
    expect(takePendingPackage('pack')).toBeNull();
    expect(takePendingPackage('template')).toBe('D:/dl/a.vidtsxtemplate');
  });

  it('recognises a pack and every kind of single as one kind (TRANSITION_PACKS_DESIGN.md P5, FILTER_PACKS_DESIGN.md P5)', () => {
    expect(packageFromArgv(['app.exe', 'C:\dl\Motion Pack.vidtsxpack'])).toEqual({
      kind: 'pack',
      filePath: 'C:\dl\Motion Pack.vidtsxpack',
    });
    expect(packageKindFor('/tmp/swirl.VIDTSXTRANSITION')).toBe('pack');
    expect(packageKindFor('/tmp/noir.vidtsxfilter')).toBe('pack');
    setPendingPackage({ kind: 'pack', filePath: 'C:\dl\a.vidtsxpack' });
    expect(takePendingPackage('project')).toBeNull();
    expect(takePendingPackage('pack')).toBe('C:\dl\a.vidtsxpack');
    expect(hasPendingPackage()).toBe(false);
  });

  it('recognises an agent package as its own kind', () => {
    expect(packageFromArgv(['app.exe', 'C:\\dl\\vidtsx.motion-post.vidtsxagent'])).toEqual({
      kind: 'agent',
      filePath: 'C:\\dl\\vidtsx.motion-post.vidtsxagent',
    });
    // `.vidtsxagent` ends with neither ".vidtsx" nor a shared extname, so the
    // two must never be confused by a prefix match.
    expect(packageFromArgv(['app.exe', 'C:\\dl\\a.vidtsxagent'])?.kind).toBe('agent');
    expect(packageFromArgv(['app.exe', 'C:\\dl\\a.vidtsx'])?.kind).toBe('project');
  });

  it('never treats argv[0] or a switch as a path', () => {
    // The executable itself is argv[0] — a binary named *.vidtsx would
    // otherwise "open itself" on every launch.
    expect(packageFromArgv(['C:\\weird\\app.vidtsx'])).toBeNull();
    expect(packageFromArgv(['app.exe', '--flag=x.vidtsx'])).toBeNull();
  });

  it('ignores anything that is not a package', () => {
    expect(packageFromArgv(['app.exe', '.', '--dev'])).toBeNull();
    expect(packageFromArgv(['app.exe', 'C:\\videos\\promo.mp4'])).toBeNull();
    expect(packageFromArgv(['app.exe', 'vidtsx'])).toBeNull();
    expect(packageFromArgv([])).toBeNull();
  });

  it('names the kind of a bare path, for macOS open-file', () => {
    expect(packageKindFor('/Users/h/promo.vidtsx')).toBe('project');
    expect(packageKindFor('/Users/h/motion-post.vidtsxagent')).toBe('agent');
    expect(packageKindFor('/Users/h/promo.mp4')).toBeNull();
  });
});

describe('the pending slot', () => {
  it('claims once — a second reader gets nothing', () => {
    setPendingPackage({ kind: 'project', filePath: 'C:\\videos\\promo.vidtsx' });
    expect(hasPendingPackage()).toBe(true);
    expect(takePendingPackage('project')).toBe('C:\\videos\\promo.vidtsx');
    expect(takePendingPackage('project')).toBeNull();
    expect(hasPendingPackage()).toBe(false);
  });

  it('the newest open wins when one arrives before the last was claimed', () => {
    setPendingPackage({ kind: 'project', filePath: 'C:\\a.vidtsx' });
    setPendingPackage({ kind: 'project', filePath: 'C:\\b.vidtsx' });
    expect(takePendingPackage('project')).toBe('C:\\b.vidtsx');
  });

  it('never hands a package to the screen that cannot open it', () => {
    setPendingPackage({ kind: 'agent', filePath: 'C:\\dl\\a.vidtsxagent' });
    // Studio's project browser mounts on almost every launch, and before Agents
    // does. Without the kind it would claim this and drop it on the floor.
    expect(takePendingPackage('project')).toBeNull();
    expect(hasPendingPackage('project')).toBe(false);
    expect(hasPendingPackage('agent')).toBe(true);
    expect(takePendingPackage('agent')).toBe('C:\\dl\\a.vidtsxagent');
  });
});
