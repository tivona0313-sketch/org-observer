#!/usr/bin/env python3
"""Build reusable Chinese/English translations of public article fields."""
import argparse
import hashlib
import http.client
import json
import os
import re
import socket
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("title", "summary", "sourceTitle", "source", "points", "takeaway", "question", "caveat")
PROVIDER = "Google Translate · machine translation"


def article_fields(article):
    return {
        field: article[field]
        for field in FIELDS
        if isinstance(article.get(field), (str, list))
    }


def curated_articles(path):
    # Read only the site's public data file, never personal browser data.
    program = """const fs=require("fs"),vm=require("vm");
const context={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],"utf8"),context,{timeout:1000});
process.stdout.write(JSON.stringify(context.window.ORG_DATA.articles));"""
    result = subprocess.run(
        ["node", "-e", program, str(path)],
        check=True, capture_output=True, text=True, timeout=10,
    )
    articles = json.loads(result.stdout)
    if not isinstance(articles, list):
        raise ValueError("Invalid curated article data")
    return articles


def source_language(text):
    return "zh" if re.search(r"[\u3400-\u9fff]", text) else "en"


def translate_text(text):
    source = source_language(text)
    query = urllib.parse.urlencode({
        "client": "gtx", "sl": "zh-CN" if source == "zh" else "en",
        "tl": "en" if source == "zh" else "zh-CN", "dt": "t", "q": text,
    })
    request = urllib.request.Request(
        "https://translate.googleapis.com/translate_a/single?" + query,
        headers={"User-Agent": "OrgObserver/1.0", "Accept": "application/json"},
    )
    # One immediate retry covers transient 5xx and connection timeouts.
    # Rate limits (429) and other permanent errors stop the batch immediately.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read(500_001)
                if len(body) > 500_000:
                    raise ValueError("Translation response is too large")
            break
        except urllib.error.HTTPError as error:
            if attempt or error.code < 500:
                raise
        except (socket.timeout, urllib.error.URLError, http.client.RemoteDisconnected):
            if attempt:
                raise
    result = json.loads(body)
    translated = "".join(segment[0] for segment in result[0] if segment and isinstance(segment[0], str)).strip()
    if not translated:
        raise ValueError("Empty translation")
    return {"zh": text if source == "zh" else translated,
            "en": translated if source == "zh" else text}


def cached_texts(cache):
    texts = {}
    if cache.get("schemaVersion") != 1:
        return texts
    for entry in cache.get("articles", {}).values():
        for field, original in entry.get("original", {}).items():
            originals = original if isinstance(original, list) else [original]
            zh = entry.get("zh", {}).get(field)
            en = entry.get("en", {}).get(field)
            zhs = zh if isinstance(zh, list) else [zh]
            ens = en if isinstance(en, list) else [en]
            if len(originals) != len(zhs) or len(originals) != len(ens):
                continue
            for text, chinese, english in zip(originals, zhs, ens):
                if not all(isinstance(value, str) and value.strip() for value in (text, chinese, english)):
                    continue
                source = source_language(text)
                if (chinese if source == "zh" else english) == text:
                    texts[text] = {"zh": chinese, "en": english}
    return texts


def build_bilingual(articles, cache, translator=translate_text):
    originals = {a["id"]: article_fields(a) for a in articles}
    texts = cached_texts(cache)
    checkpoint = Path(os.environ["ORG_TRANSLATION_CHECKPOINT"]) if os.environ.get("ORG_TRANSLATION_CHECKPOINT") else None
    if checkpoint and checkpoint.exists():
        saved = json.loads(checkpoint.read_text(encoding="utf-8"))
        for text, pair in saved.items():
            if isinstance(pair, dict) and all(isinstance(pair.get(lang), str) and pair[lang].strip() for lang in ("zh", "en")) and pair[source_language(text)] == text:
                texts[text] = pair
    required = []
    for fields in originals.values():
        for value in fields.values():
            for text in value if isinstance(value, list) else [value]:
                if not isinstance(text, str):
                    raise ValueError("Article field contains a non-text value")
                if text and text not in texts:
                    required.append(text)
    required = list(dict.fromkeys(required))
    print(f"Translation cache: {len(originals)} articles; {len(required)} new or changed texts", flush=True)
    # Keep only three requests in flight. An error stops further requests and
    # prevents either published JSON file from being overwritten.
    with ThreadPoolExecutor(max_workers=3) as pool:
        remaining = iter(required)
        pending = {}
        for _ in range(min(3, len(required))):
            text = next(remaining)
            pending[pool.submit(translator, text)] = text
        completed = 0
        try:
            while pending:
                done, _ = wait(pending, return_when=FIRST_COMPLETED)
                for future in done:
                    text = pending.pop(future)
                    try:
                        pair = future.result()
                    except Exception as error:
                        raise RuntimeError(f"Translation failed for {text[:160]!r}: {type(error).__name__}: {error}") from error
                    if not all(isinstance(pair.get(lang), str) and pair[lang].strip() for lang in ("zh", "en")):
                        raise ValueError("Incomplete bilingual translation")
                    source = source_language(text)
                    if pair[source] != text:
                        raise ValueError("Translation changed original text")
                    texts[text] = pair
                    completed += 1
                if completed % 20 < len(done) or completed == len(required):
                    print(f"Translated {completed}/{len(required)} texts", flush=True)
                for _ in done:
                    text = next(remaining, None)
                    if text is not None:
                        pending[pool.submit(translator, text)] = text
        except Exception:
            for future in pending:
                future.cancel()
            raise
        finally:
            if checkpoint:
                checkpoint.write_text(json.dumps(texts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    entries = {}
    for identifier, fields in originals.items():
        entry = {"original": fields, "zh": {}, "en": {}}
        for field, value in fields.items():
            for lang in ("zh", "en"):
                entry[lang][field] = (
                    [texts[text][lang] if text else "" for text in value]
                    if isinstance(value, list) else texts[value][lang] if value else ""
                )
        entries[identifier] = entry
    revision = hashlib.sha256(json.dumps(entries, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    if cache.get("revision") == revision and cache.get("schemaVersion") == 1:
        return cache
    return {
        "schemaVersion": 1, "provider": PROVIDER,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "revision": revision, "articles": entries,
    }


def prepare_bilingual(articles, directory):
    path = directory / "bilingual.json"
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return build_bilingual(curated_articles(directory / "data.js") + articles, cache)


def write_snapshots(feed_path, payload, bilingual):
    payload["bilingualRevision"] = bilingual["revision"]
    translation_path = feed_path.parent / "bilingual.json"
    files = ((translation_path, bilingual), (feed_path, payload))
    temporary_files = []
    try:
        for destination, content in files:
            temporary = destination.with_suffix(".tmp")
            temporary_files.append(temporary)
            temporary.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for (destination, _), temporary in zip(files, temporary_files):
            temporary.replace(destination)
    finally:
        for temporary in temporary_files:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", type=Path, default=ROOT / "org-news-public/feed.json")
    args = parser.parse_args()
    feed_path = args.feed.resolve()
    payload = json.loads(feed_path.read_text(encoding="utf-8"))
    bilingual = prepare_bilingual(payload["articles"], feed_path.parent)
    write_snapshots(feed_path, payload, bilingual)
    print(f'Bilingual snapshot ready: {len(bilingual["articles"])} articles', flush=True)
