"""Import checked public-page source snapshots without refetching ready articles."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from update_content import atomic_json, key_points

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "sources/article-recovery"
SITE = ROOT / "org-news-public"


def read(name):
    return json.loads((SOURCES / name).read_text())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def clean(text):
    text = re.sub(r"\(opens in a new window\)|（在新窗口中打开）", "", text)
    text = text.replace("\u2060", "").replace("\ufeff", "")
    return re.sub(r"\s+", " ", text).strip()


def keep(block):
    text = clean(block["text"])
    if re.fullmatch(r"\d{1,2}:\d{2}", text):
        return False
    if "canary GUID" in text or "BENCHMARK DATA SHOULD NEVER APPEAR" in text:
        return False
    return text not in {
        "Join the new era of work", "迈入工作新时代",
        "OpenAI <3 startups", "OpenAI 全方位赋能初创企业",
    }


def collapse_headings(blocks):
    output = []
    for block in blocks:
        if block["kind"] == "heading" and output and output[-1]["kind"] == "heading":
            output[-1] = block
        else:
            output.append(block)
    return output


def run():
    stamp = datetime.now(timezone.utc).isoformat()
    editorial = read("editorial-zh.json")
    prepared = []
    for article in read("manifest.json"):
        identifier = article["id"]
        path = SITE / "articles" / f"{identifier}.json"
        old = json.loads(path.read_text())
        assert old["url"] == article["url"], identifier
        kind = "official"
        supplement = False
        if identifier == "tencent-project-2026":
            zh = read(f"{identifier}.zh.json")
            values = read(f"{identifier}.editorial-en.json")
            assert len(values) == len(zh["blocks"]) == 43
            for i, block in enumerate(zh["blocks"]):
                block["kind"] = "heading" if i in (9, 10, 18, 19, 32, 33) else "paragraph"
            en = {**zh, "language": "en", "blocks": [
                {**block, "text": value} for block, value in zip(zh["blocks"], values)
            ]}
            originals = zh
            kind = "ai-reviewed"
        else:
            en = read(f"{identifier}.en.json")
            zh = read(f"{identifier}.zh.json")
            assert en.get("language", "").startswith("en"), identifier
            assert len(en["blocks"]) == en["blockCount"], identifier
            originals = en
            if identifier in editorial:
                fix = editorial[identifier]
                assert digest(en["blocks"]) == fix["sourceHash"], identifier
                assert len(fix["translations"]) == len(en["blocks"]), identifier
                zh = {**en, "language": "zh-CN", "blocks": [
                    {**block, "text": value}
                    for block, value in zip(en["blocks"], fix["translations"])
                ]}
                kind = "ai-reviewed"
            else:
                assert zh.get("language", "").startswith("zh"), identifier
                assert len(zh["blocks"]) == zh["blockCount"], identifier
            if identifier == "rss-5a014341bc3fc0f1d8b6":
                # Omit the video timer and the locale-specific expandable table.
                # The article's prose, examples and conclusion remain intact.
                en = {**en, "blocks": en["blocks"][:2] + en["blocks"][3:]}
                zh = {**zh, "blocks": zh["blocks"][:23] + zh["blocks"][38:]}
                en["blocks"][22] = {**en["blocks"][22], "text": en["blocks"][22]["text"].removesuffix(" See more")}
            elif identifier == "rss-200a5d3dd39c6bfb7a20":
                # Chart headings are not article prose. Two Chinese caption
                # paragraphs correspond to one English caption; the closing
                # English quotation needs a checked supplemental translation.
                z = zh["blocks"]
                zh = {**zh, "blocks": [
                    z[0], z[1], z[3], z[4], z[5],
                    {"kind": "paragraph", "text": z[7]["text"] + z[8]["text"]},
                    z[9], z[10], {"kind": "paragraph", "text": editorial["euQuote"]},
                ]}
                kind = "official-supplemented"
                supplement = True
            elif identifier == "rss-574dbaf7fc8731e40575":
                zh = {**zh, "blocks": collapse_headings(zh["blocks"])}
                assert len(zh["blocks"]) == len(en["blocks"]) == 72
                # The first twenty organization names are a duplicated index.
                en = {**en, "blocks": en["blocks"][:3] + en["blocks"][23:]}
                zh = {**zh, "blocks": zh["blocks"][:3] + zh["blocks"][23:]}
            elif identifier == "rss-16681fd606d5f6994d06":
                # Remove the ad CTA, but retain data attribution and footnotes.
                en = {**en, "blocks": en["blocks"][:21] + en["blocks"][24:]}
                zh = {**zh, "blocks": zh["blocks"][:21] + zh["blocks"][24:]}

        assert len(en["blocks"]) == len(zh["blocks"]), identifier
        assert [b["kind"] for b in en["blocks"]] == [b["kind"] for b in zh["blocks"]], identifier
        blocks = []
        for e, z in zip(en["blocks"], zh["blocks"]):
            if not keep(e) or not keep(z):
                continue
            en_text, zh_text = clean(e["text"]), clean(z["text"])
            assert en_text and zh_text, identifier
            blocks.append({
                "id": f"p{len(blocks) + 1}", "kind": e["kind"],
                "text": zh_text if identifier == "tencent-project-2026" else en_text,
                "en": en_text, "zh": zh_text,
            })
        assert len(blocks) >= 4, identifier
        record = {
            "schemaVersion": 1, "id": identifier, "url": old["url"],
            "sourceTitle": old["sourceTitle"], "status": "ready",
            "attemptedAt": stamp, "fetchedAt": originals.get("retrievedAt", stamp),
            "finalURL": originals["url"], "language": "zh" if identifier == "tencent-project-2026" else "en",
            "originalTitle": originals["title"],
            "author": "林秋艺、王怡洁（中国企业家）" if identifier == "tencent-project-2026" else (
                "Hemanth Asirvatham, Elliott Mokski" if identifier == "rss-e2ed7680c50ae3f074e0" else "OpenAI"
            ),
            "blocks": blocks, "keyPoints": key_points(blocks, old["sourceTitle"]),
            "method": "public-page-browser / checked-paragraph-alignment / extractive-key-sentences",
            "translationKind": kind,
            "translation": "Official publisher bilingual text" if kind == "official" else (
                "Official publisher Chinese text with a checked AI-translated quotation" if supplement
                else "AI translation checked against source paragraphs"
            ),
            "sourceVersions": {
                "original": {"url": originals["url"], "title": originals["title"]},
                **({"zh": {"url": zh["url"], "title": zh["title"]}} if kind.startswith("official") else {}),
            },
            "contentHash": digest(blocks),
            "recoveryCheckedAt": stamp,
        }
        if kind.startswith("official"):
            record["translationSourceURL"] = zh["url"]
        prepared.append((path, record))
    assert len(prepared) == 57
    for path, record in prepared:
        atomic_json(path, record)
    index_path = SITE / "content-index.json"
    index = json.loads(index_path.read_text())
    for _, record in prepared:
        index["articles"][record["id"]] = {k: record[k] for k in (
            "status", "url", "sourceTitle", "contentHash", "fetchedAt"
        )}
    index["updatedAt"] = stamp
    atomic_json(index_path, index)
    print(json.dumps({
        "recovered": len(prepared),
        "paragraphs": sum(len(r["blocks"]) for _, r in prepared),
        "official": sum(r["translationKind"] == "official" for _, r in prepared),
        "officialSupplemented": sum(r["translationKind"] == "official-supplemented" for _, r in prepared),
        "aiReviewed": sum(r["translationKind"] == "ai-reviewed" for _, r in prepared),
    }))


if __name__ == "__main__":
    run()
