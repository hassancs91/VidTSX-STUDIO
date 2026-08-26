// The file-association hand-off: what counts as a package path on argv, and
// the one-shot claim that stops two windows importing the same file.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasPendingPackage,
  packagePathFromArgv,
  setPendingPackage,
  takePendingPackage,
} from './package-open';

beforeEach(() => {
  takePendingPackage();
});

describe('packagePathFromArgv', () => {
  it('finds the package however the OS orders the argv', () => {
    expect(packagePathFromArgv(['electron.exe', 'C:\\videos\\promo.vidtsx'])).toBe(
      'C:\\videos\\promo.vidtsx',
    );
    expect(
      packagePathFromArgv(['app.exe', '--allow-file-access', 'D:\\hand-offs\\cut 2.vidtsx']),
    ).toBe('D:\\hand-offs\\cut 2.vidtsx');
    expect(packagePathFromArgv(['app.exe', '/home/h/promo.VIDTSX'])).toBe('/home/h/promo.VIDTSX');
  });

  it('never treats argv[0] or a switch as a path', () => {
    // The executable itself is argv[0] — a binary named *.vidtsx would
    // otherwise "open itself" on every launch.
    expect(packagePathFromArgv(['C:\\weird\\app.vidtsx'])).toBeNull();
    expect(packagePathFromArgv(['app.exe', '--flag=x.vidtsx'])).toBeNull();
  });

  it('ignores anything that is not a package', () => {
    expect(packagePathFromArgv(['app.exe', '.', '--dev'])).toBeNull();
    expect(packagePathFromArgv(['app.exe', 'C:\\videos\\promo.mp4'])).toBeNull();
    expect(packagePathFromArgv(['app.exe', 'vidtsx'])).toBeNull();
    expect(packagePathFromArgv([])).toBeNull();
  });
});

describe('the pending slot', () => {
  it('claims once — a second reader gets nothing', () => {
    setPendingPackage('C:\\videos\\promo.vidtsx');
    expect(hasPendingPackage()).toBe(true);
    expect(takePendingPackage()).toBe('C:\\videos\\promo.vidtsx');
    expect(takePendingPackage()).toBeNull();
    expect(hasPendingPackage()).toBe(false);
  });

  it('the newest open wins when one arrives before the last was claimed', () => {
    setPendingPackage('C:\\a.vidtsx');
    setPendingPackage('C:\\b.vidtsx');
    expect(takePendingPackage()).toBe('C:\\b.vidtsx');
  });
});
