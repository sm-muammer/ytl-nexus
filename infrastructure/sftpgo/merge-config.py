#!/usr/bin/env python3
"""Merge the Nexus overrides into the package's default SFTPGo configuration.

usage: merge-config.py <default.json> <overrides.json> <output.json>

Objects are merged key by key. Lists and scalars in the overrides replace the
default. Run by setup-sftpgo, always from the saved original, so running it
again gives the same file.
"""
import json
import sys


def merge(base, extra):
    if isinstance(base, dict) and isinstance(extra, dict):
        out = dict(base)
        for key, value in extra.items():
            out[key] = merge(base[key], value) if key in base else value
        return out
    return extra


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as f:
        base = json.load(f)
    with open(sys.argv[2], encoding="utf-8") as f:
        extra = json.load(f)
    merged = merge(base, extra)
    # List items in bindings carry many defaults. Fill the ones the override leaves out.
    for section in ("sftpd", "ftpd", "webdavd", "httpd"):
        defaults = base.get(section, {}).get("bindings", [{}])[0]
        merged[section]["bindings"] = [
            {**defaults, **item} for item in merged[section]["bindings"]
        ]
    with open(sys.argv[3], "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
