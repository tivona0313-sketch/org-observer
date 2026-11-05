#!/usr/bin/env python3
"""Extract, translate and cache article bodies separately from the feed."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

from translate_feed import ROOT, curated_articles
from offline_translate import detect_language, translate_batch

HOSTS = {
    "blog.google", "blogs.microsoft.com", "www.microsoft.com",
    "openai.com", "about.fb.com", "www.anthropic.com",
    "www.aboutamazon.com", "www.alibabacloud.com", "www.ce.cn",
}
TRANSLATION_LOCK = threading.Lock()
SCHEMA = 1


def now():
    return datetime.now(timezone.utc).isoformat()


def valid_url(url):
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in HOSTS and not parsed.username and not parsed.password and parsed.port in (None, 443)


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not valid_url(newurl):
            raise ValueError("redirect_outside_source")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def extract(article):
    if not valid_url(article["url"]):
        raise ValueError("unsupported_source")
    request = urllib.request.Request(article["url"], headers={
        "User-Agent": "OrgObserver/1.0 (public news reader)",
        "Accept": "text/html", "Accept-Language": "en,zh;q=0.8",
    })
    with urllib.request.build_opener(SafeRedirect()).open(request, timeout=25) as response:
        if "html" not in response.headers.get("Content-Type", ""):
            raise ValueError("not_html")
        raw = response.read(8_000_001)
        if len(raw) > 8_000_000:
            raise ValueError("page_too_large")
        encoding = response.headers.get_content_charset()
        if not encoding:
            match = re.search(br'charset=["\']?([\w-]+)', raw[:10000], re.I)
            encoding = match[1].decode() if match else "utf-8"
        html = raw.decode(encoding, errors="replace")
        final_url = response.geturl()
    if re.search(r"<title[^>]*>\s*(?:Just a moment|Access denied|Robot Check|Attention Required)", html, re.I):
        raise ValueError("access_restricted")
    result = subprocess.run(
        ["node", str(ROOT / "scripts/extract_article.mjs")],
        input=json.dumps({"html": html, "url": final_url}),
        capture_output=True, text=True, check=True, timeout=45,
    )
    extracted = json.loads(result.stdout)
    blocks = extracted["blocks"]
    # Discard duplicate title and obvious UI controls, never truncate prose.
    blocks = [b for b in blocks if b["text"] != extracted["title"] and not re.fullmatch(
        r"(?:Share|Copy link|Copied|Read more|Listen to article|Subscribe|Sign up|分享|复制链接)", b["text"], re.I)]
    for index, block in enumerate(blocks):
        if index>len(blocks)/2 and re.fullmatch(r"(?:Related|Trending) news and stories",block["text"],re.I):
            blocks=blocks[:index]
            break
    blocks=[b for b in blocks if re.search(r"\w",b["text"])]
    text = "\n".join(b["text"] for b in blocks)
    if len(text) < max(450, len(article.get("summary", "")) * 1.3) or len(blocks) < 2:
        raise ValueError("insufficient_body")
    if len(text) > 180000:
        raise ValueError("body_too_large")
    if re.search(r"enable (?:javascript|cookies).*?(?:continue|proceed)|verify (?:you are|that you)", text[:1000], re.I):
        raise ValueError("access_restricted")
    extracted.update(blocks=blocks, finalURL=final_url, extractedAt=now(), extractorVersion=2)
    return extracted


def translated_blocks(blocks, language, cache, checkpoint):
    # Offline batches retain an explicit paragraph mapping and original text.
    original = [b["text"] for b in blocks]
    output = {"zh": [], "en": []}
    for lang in ("en","zh"):
        if language.startswith(lang):
            output[lang] = original[:]
            continue
        keys=[hashlib.sha256(("argos1.9-clauses-v3\0"+language+"\0"+lang+"\0"+text).encode()).hexdigest() for text in original]
        missing=[]
        for i,key in enumerate(keys):
            with TRANSLATION_LOCK:
                value = cache.get(key)
            if not value:missing.append(i)
        if missing:
            values=translate_batch([original[i] for i in missing],language,lang)
            if len(values)!=len(missing):raise ValueError("translation_alignment_failed")
            with TRANSLATION_LOCK:
                for i,value in zip(missing,values):cache[keys[i]]=value
                if checkpoint:
                    temp=checkpoint.with_suffix(".tmp")
                    temp.write_text(json.dumps(cache,ensure_ascii=False),encoding="utf-8")
                    temp.replace(checkpoint)
        output[lang]=[cache[key] for key in keys]
    return [{**block, "id":f"p{i+1}", "zh":output["zh"][i], "en":output["en"][i]} for i, block in enumerate(blocks)]


def key_points(blocks, title):
    """Extract representative sentences with exact paragraph references."""
    keywords = set(re.findall(r"[a-z]{4,}", title.lower())) - {"with","from","that","this","into","have","more","will","some","about","what","your","their","using","today","shared","announcing","message","thoughts"}
    candidates = []
    for i, block in enumerate(blocks):
        if block["kind"] not in ("paragraph","list") or len(block["en"]) < 75:
            continue
        score = sum(2 for word in keywords if word in block["en"].lower())
        score += 3 if re.search(r"\d|launch|introduc|announc|will |plan|help|enable|team|employee|develop", block["en"], re.I) else 0
        score += 5 if re.search(r"\b(?:workforce|employees|roles|leadership|organizational|hiring|trainings?|workshops|learning|skills|responsibility|management|restructuring|ownership)\b",block["en"],re.I) else 0
        score += 2 if re.search(r"\d",block["en"]) else 0
        score += 2 if re.search(r"\b(?:survey|study|research|findings|participants|limitations)\b",block["en"],re.I) else 0
        score += 2 if i < len(blocks)/3 else 0
        candidates.append((score, i))
    selected = []
    for _, index in sorted(candidates, key=lambda item:(-item[0],item[1])):
        words=set(re.findall(r"[a-z]{3,}",blocks[index]["en"].lower()))
        if all(len(words & set(re.findall(r"[a-z]{3,}",blocks[old]["en"].lower())))/max(1,len(words))<0.85 for old in selected):
            selected.append(index)
        if len(selected)==4:
            break
    if len(selected)<3:
        for _, index in sorted(candidates, reverse=True):
            if index not in selected:
                selected.append(index)
            if len(selected)==min(3,len(candidates)):
                break
    points=[]
    for index in sorted(selected):
        block=blocks[index]
        # First complete sentence in each language: exact extracts, not claims
        # generated from a short RSS teaser. No arbitrary character truncation.
        point={"paragraphId":block["id"]}
        for lang in ("zh","en"):
            sentences=re.split(r"(?<=[。！？])|(?<=[.!?])\s+(?=[A-Z])",block[lang])
            sentences=[s.strip() for s in sentences if s.strip()]
            point[lang]=("".join(sentences[:2]) if lang=="zh" else " ".join(sentences[:2])) or block[lang]
        points.append(point)
    return points


def atomic_json(path, data):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temp.replace(path)


def update_content(directory, articles, *, force=False, extract_only=False, limit=None, ids=None, retranslate=False):
    body_dir = directory / "articles"
    body_dir.mkdir(exist_ok=True)
    checkpoint_value=os.environ.get("ORG_BODY_TRANSLATION_CACHE")
    checkpoint=Path(checkpoint_value) if checkpoint_value else None
    cache=json.loads(checkpoint.read_text()) if checkpoint and checkpoint.exists() else {}
    records = {a["id"]:a for a in curated_articles(directory/"data.js")+articles}
    targets = list(records.values())[:limit] if limit else list(records.values())
    if ids:
        targets=[article for article in targets if article["id"] in ids]
    def process(article):
        identifier=article["id"]
        if not re.fullmatch(r"[a-z0-9-]+",identifier):
            raise ValueError("invalid_article_id")
        path=body_dir/f"{identifier}.json"
        old=json.loads(path.read_text()) if path.exists() else {}
        same=old.get("url")==article["url"] and old.get("sourceTitle")==article["title"]
        if retranslate and old.get("status")!="ready":
            return old
        if same and old.get("schemaVersion")==SCHEMA and not force and not retranslate:
            if old.get("status")=="ready":
                return old
            if old.get("status")=="unavailable" and old.get("nextAttempt") and old["nextAttempt"]>now():
                return old
        attempted=now()
        try:
            if retranslate and same and old.get("status")=="ready":
                extracted={"blocks":[{"kind":b["kind"],"text":b["text"]} for b in old["blocks"]],
                           "title":old.get("originalTitle",old["sourceTitle"]),"author":old.get("author",""),
                           "language":old["language"],"finalURL":old["finalURL"],"extractedAt":old["fetchedAt"]}
            elif same and old.get("extracted",{}).get("extractorVersion")==2:
                extracted=old["extracted"]
            else:
                extracted=extract(article)
            if extract_only:
                record={"schemaVersion":SCHEMA,"id":identifier,"url":article["url"],"sourceTitle":article["title"],
                        "status":"translation_pending","attemptedAt":attempted,"extracted":extracted}
            else:
                extracted["language"]=detect_language(" ".join(b["text"] for b in extracted["blocks"]))
                blocks=translated_blocks(extracted["blocks"],extracted["language"],cache,checkpoint)
                record={"schemaVersion":SCHEMA,"id":identifier,"url":article["url"],"sourceTitle":article["title"],
                        "status":"ready","attemptedAt":attempted,"fetchedAt":extracted["extractedAt"],
                        "finalURL":extracted["finalURL"],"language":extracted["language"],
                        "originalTitle":extracted["title"],
                        "author":extracted.get("author",""),"blocks":blocks,
                        "keyPoints":key_points(blocks,extracted["title"]),
                        "method":"defuddle-0.19.6 / extractive-key-sentences",
                        "translation":"Argos Open Tech 1.9 / offline machine translation",
                        "contentHash":hashlib.sha256(json.dumps(blocks,sort_keys=True).encode()).hexdigest()}
            atomic_json(path,record)
            print(f'{identifier}: {record["status"]}; {len(extracted["blocks"])} paragraphs',flush=True)
            return record
        except Exception as error:
            code=f"http_{error.code}" if isinstance(error,urllib.error.HTTPError) else str(error)[:150]
            # Successful older body is never replaced by an error or RSS teaser.
            if old.get("status")=="ready" and same:
                record={**old,"lastAttempt":attempted,"lastError":code}
            else:
                record={"schemaVersion":SCHEMA,"id":identifier,"url":article["url"],"sourceTitle":article["title"],
                        "status":"unavailable","attemptedAt":attempted,"error":code,
                        "nextAttempt":(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()}
                if "extracted" in locals():
                    record.update(status="translation_pending",extracted=extracted)
            atomic_json(path,record)
            print(f"{identifier}: {record['status']}; {code}",flush=True)
            return record
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(process,targets))
    index={}
    for identifier in records:
        path=body_dir/f"{identifier}.json"
        if path.exists():
            value=json.loads(path.read_text())
            index[identifier]={k:value[k] for k in ("status","url","sourceTitle","contentHash","fetchedAt","error") if k in value}
    atomic_json(directory/"content-index.json",{"schemaVersion":SCHEMA,"updatedAt":now(),"articles":index})
    counts={status:sum(x["status"]==status for x in index.values()) for status in ("ready","translation_pending","unavailable")}
    print(json.dumps(counts),flush=True)
    return counts


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory",type=Path,default=ROOT/"org-news-public")
    parser.add_argument("--force",action="store_true")
    parser.add_argument("--extract-only",action="store_true")
    parser.add_argument("--limit",type=int)
    parser.add_argument("--ids",nargs="+")
    parser.add_argument("--retranslate",action="store_true")
    args=parser.parse_args()
    payload=json.loads((args.directory/"feed.json").read_text())
    update_content(args.directory,payload["articles"],force=args.force,extract_only=args.extract_only,limit=args.limit,ids=args.ids,retranslate=args.retranslate)
