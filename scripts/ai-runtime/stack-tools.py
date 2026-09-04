"""stack-tools.py - stdlib-only helpers called by build-stack.ps1 (any CPython >= 3.8).

  stats <runtimeDir>
      JSON: {"files", "bytes", "maxRelativePathLength", "deepestPath"} over every file under
      <runtimeDir>, excluding a root-level manifest.json (so the numbers the manifest states
      are about everything *else*). Relative paths are Windows-style (backslashes), which is
      what the app's path-length guard adds to len(root) + 1.

  zip <runtimeDir> <out.zip> [--level N] [--date YYYY-MM-DD]
      Deflate zip64 archive; entries are relative to <runtimeDir> (manifest.json, python/...,
      licenses/...), forward slashes, sorted, with one fixed timestamp -> the same tree always
      produces byte-identical zips, so the sha256 in the catalogue is reproducible.
      Streams each file (no whole-file reads: torch_cuda.dll alone is > 1 GB).
"""
import argparse
import json
import os
import shutil
import sys
import time
import zipfile


def walk_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            if rel.lower() == "manifest.json":
                continue
            yield full, rel


def cmd_stats(args):
    files = 0
    total = 0
    deepest = ""
    for full, rel in walk_files(args.dir):
        files += 1
        total += os.path.getsize(full)
        if len(rel) > len(deepest):
            deepest = rel
    print(json.dumps({
        "files": files,
        "bytes": total,
        "maxRelativePathLength": len(deepest),
        "deepestPath": deepest.replace(os.sep, "\\"),
    }))


def cmd_zip(args):
    y, m, d = (int(x) for x in args.date.split("-"))
    stamp = (y, m, d, 0, 0, 0)
    if os.path.exists(args.out):
        os.remove(args.out)
    t0 = time.perf_counter()
    n = raw = 0
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED, allowZip64=True, compresslevel=args.level) as z:
        for full, rel in _all_files_including_manifest(args.dir):
            zi = zipfile.ZipInfo.from_file(full, rel.replace(os.sep, "/"))
            zi.date_time = stamp
            zi.compress_type = zipfile.ZIP_DEFLATED
            if hasattr(zi, "compress_level"):
                zi.compress_level = args.level
            else:  # CPython <= 3.12 keeps it private
                zi._compresslevel = args.level  # noqa: SLF001
            with open(full, "rb") as src, z.open(zi, "w") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            n += 1
            raw += zi.file_size
    print(json.dumps({
        "zip": args.out,
        "files": n,
        "rawBytes": raw,
        "zipBytes": os.path.getsize(args.out),
        "level": args.level,
        "seconds": round(time.perf_counter() - t0, 1),
    }))


def _all_files_including_manifest(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            yield full, os.path.relpath(full, root)


def main(argv):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("stats")
    s.add_argument("dir")
    s.set_defaults(fn=cmd_stats)
    zp = sub.add_parser("zip")
    zp.add_argument("dir")
    zp.add_argument("out")
    zp.add_argument("--level", type=int, default=6)
    zp.add_argument("--date", default="1980-01-01")
    zp.set_defaults(fn=cmd_zip)
    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main(sys.argv[1:])
