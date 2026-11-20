"""Translation provider selection and OpenAI-compatible LLM translation."""
import json
import os
import re
import urllib.error
import urllib.request

GLOSSARY = """Use these preferred Chinese terms consistently:
AI agent = 智能体; agentic = 智能体驱动的; inference = 推理;
frontier model = 前沿模型; fine-tuning = 微调; workforce = 劳动力队伍;
operating model = 运营模式; organizational design = 组织设计;
management layer = 管理层级; individual contributor = 个人贡献者;
go-to-market = 市场进入策略; startup = 初创企业.
Keep product, company, model and program names in their official form."""


def _setting(name, default=""):
    return os.environ.get(name, "").strip() or default


def provider_name():
    requested = _setting("ORG_TRANSLATION_PROVIDER", "auto").lower()
    has_key = bool(_setting("ORG_LLM_API_KEY"))
    if requested == "offline":
        return "Argos Open Tech 1.9 offline machine translation"
    if requested in ("auto", "llm") and has_key:
        return f"LLM · {_setting('ORG_LLM_MODEL', 'configured OpenAI-compatible model')}"
    if requested == "llm":
        raise RuntimeError("ORG_TRANSLATION_PROVIDER=llm requires ORG_LLM_API_KEY")
    return "Argos Open Tech 1.9 offline machine translation"


def provider_id():
    return "llm:" + _setting("ORG_LLM_MODEL", "configured") if provider_name().startswith("LLM") else "argos-1.9"


def translation_workers():
    default = 8 if provider_name().startswith("LLM") else 3
    try:
        return max(1, min(int(_setting("ORG_TRANSLATION_WORKERS", str(default))), 12))
    except ValueError:
        return default


def _json_response(raw):
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.S)
        if not match:
            raise ValueError("llm_translation_not_json")
        value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise ValueError("llm_translation_invalid_json")
    return value


def _chat(messages):
    base = _setting("ORG_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps({
            "model": _setting("ORG_LLM_MODEL", "gpt-4.1-mini"),
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }).encode(),
        headers={
            "Authorization": f"Bearer {_setting('ORG_LLM_API_KEY')}",
            "Content-Type": "application/json",
            "User-Agent": "OrgObserver/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read(800).decode("utf-8", "replace")
        raise RuntimeError(f"llm_http_{error.code}: {detail}") from error
    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("llm_translation_empty_response")
    return _json_response(content)


def _system(source, target):
    target_name = "Chinese (Simplified)" if target == "zh" else "English"
    source_name = {"zh": "Chinese", "en": "English", "fr": "French"}.get(source, source)
    return (
        "You are a senior bilingual editor for technology, AI, organizational design, "
        "and business writing. Translate faithfully from "
        f"{source_name} to natural, professional {target_name}. Do not summarize, "
        "add facts, omit qualifiers, explain, or write marketing copy. Preserve "
        "numbers, dates, links, formatting and paragraph boundaries. "
        + GLOSSARY
    )


def _llm_translate_batch(texts, source, target, context=""):
    if not texts:
        return []
    # Bounded batches retain article-level context without asking the model to
    # reconstruct a long article in a single response.
    response = _chat([
        {"role": "system", "content": _system(source, target)},
        {"role": "user", "content": json.dumps({
            "context": context[:1600],
            "texts": [{"id": index, "text": text} for index, text in enumerate(texts)],
            "output": "Return only JSON: {\"translations\":[{\"id\":0,\"text\":\"...\"}]}",
        }, ensure_ascii=False)},
    ])
    values = response.get("translations")
    if not isinstance(values, list) or len(values) != len(texts):
        raise ValueError("llm_translation_alignment_failed")
    translated = [None] * len(texts)
    for expected, item in enumerate(values):
        if not isinstance(item, dict) or item.get("id") != expected:
            raise ValueError("llm_translation_order_failed")
        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("llm_translation_empty_item")
        translated[expected] = text.strip()
    return translated


def translate_batch(texts, source, target, *, context=""):
    """Translate text while preserving input order and source text elsewhere."""
    if source == target:
        return list(texts)
    if provider_name().startswith("LLM"):
        output = []
        # Avoid provider token limits while keeping adjacent paragraphs together.
        batch = []
        size = 0
        for text in texts:
            if batch and (len(batch) >= 10 or size + len(text) > 12000):
                output.extend(_llm_translate_batch(batch, source, target, context))
                batch, size = [], 0
            batch.append(text)
            size += len(text)
        if batch:
            output.extend(_llm_translate_batch(batch, source, target, context))
        return output
    # Keep the optional local-model dependency out of the quality-provider path.
    from offline_translate import translate_batch as offline_translate_batch
    return offline_translate_batch(texts, source, target)
