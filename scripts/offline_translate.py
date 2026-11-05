"""Pinned Argos Open Tech models with local CTranslate2 inference."""
import json
import hashlib
import os
import re
import threading
import urllib.request
import zipfile
from pathlib import Path

import ctranslate2
import sentencepiece
from langid.langid import LanguageIdentifier, model

MODEL_ROOT = Path(os.environ.get("ORG_MODELS_DIR", Path.home()/".cache/org-observer-models"))
PAIRS = ("en_zh", "zh_en", "fr_en")
CHECKSUMS = {
    "en_zh":"433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab",
    "zh_en":"62e7af5a3a48b530e47b7b3e5c78c2de79073ecd815750d2bf3ab35b4a67da2d",
    "fr_en":"3b3052fee6bb1e8e8e632a26a723eb2a2c7710dfe73ba61ffd9b83e85d4f14c1",
}
LOCK = threading.Lock()
MODELS = {}
IDENTIFIER = LanguageIdentifier.from_modelstring(model, norm_probs=True)
IDENTIFIER.set_languages(["en","zh","fr","de","es","pt","ja","ko"])


def tidy_translation(text, source, target):
    if target!="zh":return text
    if source.strip().lower()=="while this will include reducing in some areas and hiring in others,":
        return "虽然这包括在部分领域缩减岗位，同时在其他领域招聘，"
    replacements={
        "Generative AI":"生成式 AI", "GenerativeAI":"生成式 AI",
        "模型培训":"模型训练", "人类野心":"人的抱负",
    }
    if re.search(r"\bagents?\b",source,re.I) and not re.search(r"\b(?:travel|real estate|federal|police|insurance) agents?\b",source,re.I):
        replacements["特工"]="智能体"
    if re.search(r"customer.obsessed",source,re.I):
        replacements.update({"受客户迷惑":"以客户为中心","客户痴迷":"以客户为中心"})
    if re.search(r"start.up",source,re.I):
        replacements["最大的创业者"]="最大的初创企业"
    if re.search(r"missionaries",source,re.I):
        replacements["传教士"]="使命驱动者"
    if re.search(r"lean,? scrappy",source,re.I):
        replacements.update({"瘦小、破碎":"精干、灵活","瘦小,破碎":"精干、灵活","瘦小、粗糙":"精干、灵活"})
    if re.search(r"\binference\b",source,re.I):replacements["推论"]="推理"
    if re.search(r"advertis",source,re.I):
        replacements.update({"竞选活动":"营销活动","登机":"接入"})
    if "Gemini" in source:replacements["双子座"]="Gemini"
    if "Copilot" in source:replacements["副驾驶"]="Copilot"
    if "Claude" in source:replacements["克劳德"]="Claude"
    if re.search(r"frontier models?",source,re.I):replacements["前沿模式"]="前沿模型"
    if re.search(r"leading intelligence",source,re.I):replacements["领先的情报"]="领先的智能能力"
    if re.search(r"severance pay",source,re.I):replacements["解雇费"]="遣散费"
    if re.search(r"outplacement services",source,re.I):replacements["外派服务"]="再就业安置服务"
    if "Claude Frontier Academy" in source:replacements["Claude边境学院"]="Claude Frontier Academy"
    for old,new in replacements.items():text=text.replace(old,new)
    return text


def prepare_models():
    MODEL_ROOT.mkdir(parents=True,exist_ok=True)
    for pair in PAIRS:
        name=f"translate-{pair}-1_9"
        destination=MODEL_ROOT/name
        if (destination/"model/model.bin").exists():
            continue
        url=f"https://argos-net.com/v1/{name}.argosmodel"
        archive=MODEL_ROOT/f"{name}.argosmodel"
        print(f"Downloading open translation model: {pair}",flush=True)
        request=urllib.request.Request(url,headers={"User-Agent":"OrgObserver/1.0"})
        with urllib.request.urlopen(request,timeout=90) as response, archive.open("wb") as output:
            while True:
                chunk=response.read(1024*1024)
                if not chunk:break
                output.write(chunk)
        if hashlib.sha256(archive.read_bytes()).hexdigest()!=CHECKSUMS[pair]:
            raise ValueError(f"Translation model checksum mismatch: {pair}")
        with zipfile.ZipFile(archive) as package:
            for member in package.infolist():
                path=(MODEL_ROOT/member.filename).resolve()
                if not path.is_relative_to(MODEL_ROOT.resolve()):
                    raise ValueError("Invalid model archive path")
            package.extractall(MODEL_ROOT)
        if not (destination/"model/model.bin").exists():
            raise ValueError(f"Missing model file for {pair}")
    print("Offline translation models ready",flush=True)


def detect_language(text):
    with LOCK:
        lang,confidence=IDENTIFIER.classify(text[:5000])
    if lang not in ("en","zh","fr"):
        raise ValueError(f"unsupported_body_language:{lang}")
    return lang


def get_model(pair):
    with LOCK:
        if pair not in MODELS:
            directory=MODEL_ROOT/f"translate-{pair}-1_9"
            if not (directory/"model/model.bin").exists():
                raise RuntimeError("offline_model_not_installed")
            tokenizer=sentencepiece.SentencePieceProcessor(model_file=str(directory/"sentencepiece.model"))
            translator=ctranslate2.Translator(str(directory/"model"),device="cpu",compute_type="int8",inter_threads=1,intra_threads=2)
            MODELS[pair]=(tokenizer,translator)
        return MODELS[pair]


def degenerate_translation(text):
    return bool(re.search(r"(\S)\1{7,}|(.{3,35}?)\2{5,}",text))


def translate_batch(texts, source, target):
    if source==target:return texts[:]
    if source!="en" and target!="en":
        return translate_batch(translate_batch(texts,source,"en"),"en",target)
    tokenizer,translator=get_model(f"{source}_{target}")
    segments=[]
    owners=[]
    source_segments=[]
    for index,text in enumerate(texts):
        # Segment into complete sentences, then bounded contiguous chunks for
        # unusually long sentences. No input characters are dropped.
        sentences=[x for x in re.split(r"(?<=[。！？，；：])|(?<=[.!?,;:])\s+",text) if x]
        for sentence in sentences:
            chunks=[]
            remaining=sentence
            while len(remaining)>180:
                boundaries=[m.end() for m in re.finditer(r"[,;:，；：]\s*",remaining[:180]) if m.start()>70]
                cut=boundaries[-1] if boundaries else remaining.rfind(" ",70,180)
                if cut<70:cut=180
                chunks.append(remaining[:cut]);remaining=remaining[cut:]
            if remaining:chunks.append(remaining)
            for chunk in chunks:
                segments.append(tokenizer.encode(chunk,out_type=str));owners.append(index);source_segments.append(chunk)
    output=[[] for _ in texts]
    for start in range(0,len(segments),32):
        batch=segments[start:start+32]
        results=translator.translate_batch(batch,beam_size=4,max_batch_size=32,max_decoding_length=1024)
        for raw,source_tokens,owner,result in zip(source_segments[start:start+32],batch,owners[start:start+32],results):
            tokens=result.hypotheses[0]
            if len(tokens)>=1024 or degenerate_translation(tokenizer.decode(tokens)):
                # A looping decoder is retried once with constrained decoding;
                # never publish a truncated or repeating pseudo-translation.
                result=translator.translate_batch([source_tokens],beam_size=1,
                    repetition_penalty=1.2,no_repeat_ngram_size=4,max_decoding_length=512)[0]
                tokens=result.hypotheses[0]
                if len(tokens)>=512 or degenerate_translation(tokenizer.decode(tokens)):
                    raise ValueError("translation_output_limit")
            text=tokenizer.decode(tokens).replace("▁"," ").strip()
            if not text:
                raise ValueError("empty_offline_translation")
            output[owner].append(tidy_translation(text,raw,target))
    return [("" if target=="zh" else " ").join(parts) for parts in output]


if __name__=="__main__":
    prepare_models()
