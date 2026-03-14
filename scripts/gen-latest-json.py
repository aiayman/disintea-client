#!/usr/bin/env python3
"""Generate the latest.json update manifest for Tauri's updater plugin.

Usage:
    python3 scripts/gen-latest-json.py <version> <tag> <pub_date> <gh_repo>

Arguments:
    version   Semver string without "v" prefix, e.g. "1.0.15"
    tag       Full Git tag, e.g. "v1.0.15"
    pub_date  ISO-8601 UTC timestamp, e.g. "2026-03-14T12:00:00Z"
    gh_repo   GitHub repository slug, e.g. "owner/repo"
"""
import sys
import json
import glob
import os


def find_file(pattern):
    """Return first match under release-artifacts/ (excluding .sig files)."""
    matches = [
        p for p in glob.glob(f"release-artifacts/**/{pattern}", recursive=True)
        if not p.endswith(".sig")
    ]
    return matches[0] if matches else None


def read_sig(path):
    """Return the contents of <path>.sig, stripped of whitespace."""
    sig_path = path + ".sig"
    if os.path.isfile(sig_path):
        with open(sig_path, "r") as f:
            return f.read().strip()
    return ""


def main():
    if len(sys.argv) != 5:
        print(f"Usage: {sys.argv[0]} <version> <tag> <pub_date> <gh_repo>", file=sys.stderr)
        sys.exit(1)

    version, tag, pub_date, repo = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    base_url = f"https://github.com/{repo}/releases/download/{tag}"

    manifest = {
        "version": version,
        "notes": f"Disintea {tag}",
        "pub_date": pub_date,
        "platforms": {},
    }

    # Windows NSIS — Tauri v2 names it: {ProductName}_{ver}_x64-setup.exe
    win_exe = find_file("*-setup.exe")
    if win_exe:
        sig = read_sig(win_exe)
        if sig:
            manifest["platforms"]["windows-x86_64"] = {
                "signature": sig,
                "url": f"{base_url}/{os.path.basename(win_exe)}",
            }
        else:
            print(f"WARNING: no .sig found for {win_exe}", flush=True)
    else:
        print("WARNING: no *-setup.exe found under release-artifacts/", flush=True)

    # Linux AppImage — Tauri v2 names it: {ProductName}_{ver}_amd64.AppImage
    linux_ai = find_file("*.AppImage")
    if linux_ai:
        sig = read_sig(linux_ai)
        if sig:
            manifest["platforms"]["linux-x86_64"] = {
                "signature": sig,
                "url": f"{base_url}/{os.path.basename(linux_ai)}",
            }
        else:
            print(f"WARNING: no .sig found for {linux_ai}", flush=True)
    else:
        print("WARNING: no *.AppImage found under release-artifacts/", flush=True)

    if not manifest["platforms"]:
        print(
            "ERROR: latest.json has no platforms entry — update delivery will not work!",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    with open("latest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    print("Generated latest.json:")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
