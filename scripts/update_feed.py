#!/usr/bin/env python3
"""Fetch official RSS once and atomically update the published snapshot."""
import argparse
import importlib.util
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from translate_feed import prepare_bilingual, write_snapshots

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("org_news_server", ROOT / "org-news/server.py")
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


def next_schedule(current):
    """Match the workflow's 04:17, 10:17, 16:17, 22:17 UTC schedule."""
    for days in (0, 1):
        for hour in (4, 10, 16, 22):
            candidate = (current + timedelta(days=days)).replace(
                hour=hour, minute=17, second=0, microsecond=0
            )
            if candidate > current:
                return candidate.isoformat()


def refresh(output):
    old = {"articles": [], "sources": []}
    if output.exists():
        old = json.loads(output.read_text(encoding="utf-8"))
        if not isinstance(old.get("articles"), list) or not isinstance(old.get("sources"), list):
            raise ValueError("Invalid existing feed; refusing to overwrite it")
    previous_sources = {s["id"]: s for s in old["sources"]}
    records = {collector.https_url(a["url"]).rstrip("/"): a for a in old["articles"]}
    records.pop("", None)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(collector.fetch_source, collector.SOURCES))
    statuses = []
    succeeded = 0
    for source, (entries, status) in zip(collector.SOURCES, results):
        if entries is None:
            status["lastSuccess"] = previous_sources.get(source["id"], {}).get("lastSuccess")
        else:
            succeeded += 1
            for entry in entries:
                records[collector.https_url(entry["url"]).rstrip("/")] = entry
        statuses.append(status)
        print(f'{source["id"]}: {status["status"]}; {status["count"]} candidates'
              + (f'; {status["error"]}' if status.get("error") else ""), flush=True)
    if not succeeded:
        raise RuntimeError("All sources failed; existing snapshot was left unchanged")
    current = datetime.now(timezone.utc)
    payload = {
        "articles": sorted(records.values(), key=lambda a: a.get("date") or "", reverse=True)[:500],
        "sources": statuses,
        "refreshing": False,
        "lastRefresh": current.isoformat(),
        "nextRefresh": next_schedule(current),
        # A local validation run must not claim a live cloud scheduler.
        "deploymentMode": "github-actions" if os.environ.get("GITHUB_ACTIONS") == "true" else "static-snapshot",
    }
    bilingual = prepare_bilingual(payload["articles"], output.parent)
    write_snapshots(output, payload, bilingual)
    print(f'Updated {output.name}: {len(payload["articles"])} articles; {succeeded}/4 sources succeeded')
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "org-news-public/feed.json")
    args = parser.parse_args()
    refresh(args.output.resolve())
