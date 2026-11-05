#!/usr/bin/env python3
"""Local news reader, official RSS aggregation, and six-hour refresh."""
import argparse
import copy
import hashlib
import html
import json
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INTERVAL = 6 * 60 * 60
SOURCES = [
    {"id": "microsoft", "name": "Microsoft 官方博客", "company": "Microsoft", "url": "https://blogs.microsoft.com/feed/"},
    {"id": "google", "name": "Google The Keyword", "company": "Google", "url": "https://blog.google/rss/"},
    {"id": "openai", "name": "OpenAI News", "company": "OpenAI", "url": "https://openai.com/news/rss.xml"},
    {"id": "meta", "name": "Meta Newsroom", "company": "Meta", "url": "https://about.fb.com/news/feed/"},
]
GROUPS = [
    ("组织架构", r"\b(?:restructur\w*|organizational|organisation|leadership|appoint\w*)\b"),
    ("组织形态", r"\b(?:human.agent|hybrid.team|cross.functional|teamwork)\b"),
    ("人才结构", r"\b(?:workforce|hiring|recruit\w*|jobs|talent|employee\w*)\b"),
    ("人才标准", r"\b(?:training|upskill\w*|reskill\w*|academy|skills|certification)\b"),
    ("运营模式", r"\b(?:workflow\w*|productivity|business.process|enterprise|agentic)\b"),
    ("组织文化", r"\b(?:culture|workplace|management|collaboration)\b"),
    ("技术创新", r"\b(?:AI|artificial.intelligence|model\w*|agent\w*|research|copilot|gemini|claude)\b"),
]
LOCK = threading.Lock()
STATE = {"articles": [], "sources": [], "refreshing": False, "lastRefresh": None, "nextRefresh": None}
CACHE = Path(tempfile.gettempdir()) / ("org-observer-" + hashlib.sha256(str(ROOT).encode()).hexdigest()[:12])


def now():
    return datetime.now(timezone.utc).isoformat()


def clean_text(value):
    value = re.sub(r"<(?:script|style)\b[^>]*>.*?</(?:script|style)>", "", value, flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def https_url(value):
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return ""
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if not k.lower().startswith("utm_")]
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query), fragment=""))


def parse_date(value):
    if not value:
        return ""
    try:
        dt = parsedate_to_datetime(value)
    except (ValueError, TypeError):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    if dt > datetime.now(timezone.utc) + timedelta(days=1):
        return None
    return dt.date().isoformat()


def parse_feed(body, source):
    root = ET.fromstring(body)
    atom = "{http://www.w3.org/2005/Atom}"
    items = root.findall(".//item") or root.findall(f"{atom}entry")
    records = []
    for item in items[:100]:
        title = clean_text(item.findtext("title") or item.findtext(f"{atom}title") or "")
        link = item.findtext("link") or ""
        if not link:
            for candidate in item.findall(f"{atom}link"):
                if candidate.attrib.get("rel", "alternate") == "alternate":
                    link = candidate.attrib.get("href", "")
                    break
        link = https_url(link.strip())
        if not title or not link:
            continue
        summary = clean_text(item.findtext("description") or item.findtext(f"{atom}summary") or item.findtext(f"{atom}content") or "")
        categories = [name for name, pattern in GROUPS if re.search(pattern, title + " " + summary, re.I)]
        if not categories:
            continue
        date = parse_date(item.findtext("pubDate") or item.findtext(f"{atom}published") or item.findtext(f"{atom}updated") or "")
        if date is None:
            continue
        records.append({
            "id": "rss-" + hashlib.sha256(link.rstrip("/").encode()).hexdigest()[:20],
            "title": title, "summary": (summary[:360] + "…" if len(summary) > 360 else summary) or "该来源未提供摘要，请打开原文阅读。",
            "company": source["company"], "source": source["name"], "url": link,
            "date": date, "categories": categories[:3], "type": "官方订阅", "live": True,
            "sourceTitle": title, "sourceId": source["id"],
        })
    return records[:50]


def fetch_source(source):
    attempted = now()
    try:
        request = urllib.request.Request(source["url"], headers={"User-Agent": "OrgObserver/1.0 (personal RSS reader)", "Accept": "application/rss+xml, application/xml, text/xml"})
        with urllib.request.urlopen(request, timeout=18) as response:
            if urllib.parse.urlparse(response.geturl()).scheme != "https":
                raise ValueError("订阅跳转到非 HTTPS 地址")
            body = response.read(5_000_001)
            if len(body) > 5_000_000:
                raise ValueError("订阅响应超出大小限制")
        records = parse_feed(body, source)
        return records, {"id": source["id"], "status": "ok", "attemptedAt": attempted, "lastSuccess": now(), "count": len(records)}
    except urllib.error.HTTPError as error:
        message = f"来源返回 HTTP {error.code}"
    except Exception as error:
        message = str(error)[:180]
    return None, {"id": source["id"], "status": "failed", "attemptedAt": attempted, "error": message, "count": 0}


def load_cache():
    try:
        cached = json.loads((CACHE / "feed.json").read_text())
        if isinstance(cached.get("articles"), list) and isinstance(cached.get("sources"), list):
            STATE.update({k: cached.get(k) for k in ("articles", "sources", "lastRefresh", "nextRefresh")})
    except (OSError, ValueError, AttributeError):
        pass


def refresh_worker():
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(fetch_source, SOURCES))
        with LOCK:
            old_sources = {s["id"]: s for s in STATE["sources"]}
            records = {a["url"].rstrip("/"): a for a in STATE["articles"]}
            statuses = []
            for source, (entries, status) in zip(SOURCES, results):
                if entries is not None:
                    for entry in entries:
                        records[entry["url"].rstrip("/")] = entry
                else:
                    status["lastSuccess"] = old_sources.get(source["id"], {}).get("lastSuccess")
                statuses.append(status)
            articles = sorted(records.values(), key=lambda a: a.get("date", ""), reverse=True)[:500]
            STATE.update(articles=articles, sources=statuses, lastRefresh=now(),
                         nextRefresh=(datetime.now(timezone.utc) + timedelta(seconds=INTERVAL)).isoformat())
            snapshot = copy.deepcopy(STATE)
        CACHE.mkdir(parents=True, exist_ok=True)
        temporary = CACHE / "feed.tmp"
        temporary.write_text(json.dumps(snapshot, ensure_ascii=False))
        temporary.replace(CACHE / "feed.json")
    except Exception as error:
        print("Refresh error:", error, flush=True)
    finally:
        with LOCK:
            STATE["refreshing"] = False


def begin_refresh():
    with LOCK:
        if STATE["refreshing"]:
            return False
        STATE["refreshing"] = True
    threading.Thread(target=refresh_worker, daemon=True).start()
    return True


def schedule_loop():
    while True:
        time.sleep(INTERVAL)
        begin_refresh()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def json_response(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/feed":
            with LOCK:
                snapshot = copy.deepcopy(STATE)
            self.json_response(snapshot)
            return
        if path in ("/", "/index.html", "/styles.css", "/app.js", "/data.js"):
            super().do_GET()
            return
        self.send_error(404, "Not found")

    def do_POST(self):
        if self.path != "/api/refresh":
            self.send_error(404)
            return
        origin = self.headers.get("Origin")
        expected = "http://" + self.headers.get("Host", "")
        if self.headers.get("X-Org-Observer") != "1" or (origin and origin != expected):
            self.json_response({"error": "只接受本站发起的刷新请求"}, 403)
            return
        started = begin_refresh()
        self.json_response({"started": started, "refreshing": True}, 202)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--refresh-once", action="store_true", help="Fetch feeds once and exit")
    args = parser.parse_args()
    load_cache()
    if args.refresh_once:
        refresh_worker()
        print(json.dumps({"sources": STATE["sources"], "count": len(STATE["articles"])}, ensure_ascii=False))
    else:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
        begin_refresh()
        threading.Thread(target=schedule_loop, daemon=True).start()
        print(f"组织前沿：http://127.0.0.1:{args.port} · 服务运行期间每 6 小时检查官方订阅", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
