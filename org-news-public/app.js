(() => {
  "use strict";
  const data = window.ORG_DATA;
  const publicSite = document.documentElement.dataset.feedMode === "static";
  const $ = (id) => document.getElementById(id);
  const icons = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    radio:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10m10-10a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
    building:'<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h1m6 0h1m-8 3h1m6 0h1"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link:'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(0 -1) scale(.95)"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    external:'<path d="M14 3h7v7m0-7L10 14m-1-9H4v15h15v-5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    book:'<path d="M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1Zm0 0v15"/>',
    shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeURL = (value) => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const formatDate = (d) => d ? d.slice(0,10).replaceAll("-",".") : "日期未标注";
  const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const dated = (a) => a.date ? new Date(`${a.date.slice(0,10)}T12:00:00`).getTime() : 0;
  const storeKey = "org-observer-personal-v1";
  let storageAvailable = true;
  let personal = {saved:[],reads:{},notes:{},readDays:[],archived:{}};
  try {
    const stored = JSON.parse(localStorage.getItem(storeKey) || "null");
    if (stored && typeof stored === "object") {
      personal.saved = Array.isArray(stored.saved) ? stored.saved.filter(x=>typeof x==="string") : [];
      personal.reads = stored.reads && typeof stored.reads==="object" && !Array.isArray(stored.reads) ? stored.reads : {};
      personal.notes = stored.notes && typeof stored.notes==="object" && !Array.isArray(stored.notes) ? stored.notes : {};
      personal.readDays = Array.isArray(stored.readDays) ? stored.readDays.filter(x=>typeof x==="string") : [];
      personal.archived = stored.archived && typeof stored.archived==="object" && !Array.isArray(stored.archived) ? stored.archived : {};
    }
  } catch { storageAvailable = false; }
  let state = {view:"home",category:"全部",company:"all",period:"all",unread:false,query:"",sort:"newest",collection:null};
  let live = [], translations = {}, sourceStates = [], service = null, connected = false, staticFeed = false, pending = false, toastTimer, pollTimer, activeArticle = null, serviceFingerprint = "";
  const cloudFeed = () => staticFeed && service?.deploymentMode === "github-actions";
  try { const cached = JSON.parse(localStorage.getItem("org-observer-live-v1") || "[]"); if(Array.isArray(cached)) live = cached.filter(validArticle); } catch {}
  try { const cached = JSON.parse(localStorage.getItem("org-observer-bilingual-v1") || "null"); if(cached?.schemaVersion===1)translations=cached; } catch {}
  const articleFields=["title","summary","sourceTitle","source","points","takeaway","question","caveat"];
  const categoryEnglish={"全部":"All","组织架构":"Org structure","组织形态":"Org models","人才结构":"Talent mix","人才标准":"Talent criteria","运营模式":"Operations","技术创新":"Innovation","组织文化":"Culture"};
  const typeEnglish={"官方观点":"Official perspective","官方公告":"Official announcement","官方披露":"Official disclosure","媒体报道":"Media report","研究报告":"Research report","内部研究":"Internal research","CEO 公开信":"CEO letter","官方订阅":"Official RSS"};
  const companyEnglish={"阿里巴巴":"Alibaba","腾讯":"Tencent"};
  const label=(zh,en)=>`${esc(zh)}${en?` / <span lang="en">${esc(en)}</span>`:""}`;
  function matchingTranslation(a,bundle=translations) {
    const entry=bundle.articles?.[a.id]||a.bilingual;
    if(!entry?.original||!entry.zh||!entry.en)return null;
    for(const field of articleFields){
      if(JSON.stringify(a[field])!==JSON.stringify(entry.original[field]))return null;
      if(a[field]===undefined)continue;
      for(const lang of ["zh","en"]){
        const value=entry[lang][field];
        if(Array.isArray(a[field])){
          if(!Array.isArray(value)||value.length!==a[field].length||value.some(v=>typeof v!=="string"||!v.trim()))return null;
        }else if(typeof value!=="string"||(a[field]&&!value.trim()))return null;
      }
    }
    return entry;
  }
  function dualText(zh,en) {return `<span lang="zh-CN" class="copy-zh">${esc(zh)}</span><span lang="en" class="copy-en">${esc(en)}</span>`;}
  function articleCopy(a,field,index) {
    const entry=matchingTranslation(a);
    if(entry)return dualText(index===undefined?entry.zh[field]:entry.zh[field][index],index===undefined?entry.en[field]:entry.en[field][index]);
    const value=index===undefined?a[field]:a[field]?.[index];
    const lang=/[\u3400-\u9fff]/.test(value||"")?"zh-CN":"en";
    return `<span lang="${lang}" class="copy-${lang==="en"?"en":"zh"}">${esc(value)}</span>`;
  }
  const companyLabel=(name)=>label(name,companyEnglish[name]);
  const bodyCache=new Map();
  let contentIndex={};
  let bodyRequest=null;
  async function loadContentIndex() {
    try {
      const response=await fetch("./content-index.json",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!response.ok)return;
      const payload=await response.json();
      if(payload.schemaVersion!==1||!payload.articles)return;
      for(const [id,body] of bodyCache){
        const latest=payload.articles[id];
        if(latest?.contentHash&&latest.contentHash!==body.contentHash)bodyCache.delete(id);
      }
      contentIndex=payload.articles;render();
    }catch{}
  }
  function bodyNotice(zh,en) {
    return `<div class="body-notice">${dualText(zh,en)}</div>`;
  }
  function prepareFullReader(a) {
    bodyRequest?.abort();
    const container=$("reader-content");
    const summary=container.querySelector(".reader-summary");
    const excerpt=document.createElement("details");
    excerpt.className="reader-excerpt";
    excerpt.innerHTML="<summary>导读摘要 / Introductory summary</summary>";
    summary.before(excerpt);excerpt.append(summary);
    const supplement=document.createElement("details");
    supplement.className="reader-supplement";
    supplement.innerHTML="<summary>学习补充与信息边界 / Reflections & evidence limits</summary>";
    container.querySelector(".reader-source").before(supplement);
    container.querySelectorAll(".reader-section").forEach(section=>supplement.append(section));
    const content=document.createElement("div");
    content.id="full-article-content";
    content.setAttribute("aria-live","polite");
    excerpt.after(content);
    content.innerHTML=bodyNotice("正在读取正文与核心观点…","Loading article text and key points…");
    loadArticleBody(a);
  }
  async function loadArticleBody(a) {
    const controller=new AbortController();bodyRequest=controller;
    const timer=setTimeout(()=>controller.abort(),15000);
    let body=bodyCache.get(a.id);
    if(body&&(body.url!==a.url||body.sourceTitle!==a.title)){bodyCache.delete(a.id);body=null;}
    try {
      if(!body){
        const response=await fetch(`./articles/${encodeURIComponent(a.id)}.json`,{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("body_unavailable");
        body=await response.json();
        if(body.url!==a.url||body.sourceTitle!==a.title)throw new Error("body_mismatch");
        if(body.status==="ready")bodyCache.set(a.id,body);
      }
      if(activeArticle?.id!==a.id||controller.signal.aborted)return;
      renderArticleBody(a,body);
    } catch {
      if(activeArticle?.id!==a.id||bodyRequest!==controller)return;
      $("full-article-content").innerHTML=bodyNotice("正文暂时无法读取，导读摘要和原文链接仍可查看。","Article text is temporarily unavailable. The introductory summary and original link remain available.");
      $("reader-content").querySelector(".reader-excerpt").open=true;
    } finally {clearTimeout(timer);}
  }
  function renderArticleBody(a,body) {
    const region=$("full-article-content");
    if(body.status!=="ready"||!Array.isArray(body.blocks)||!body.blocks.length){
      const pending=body.status==="translation_pending";
      region.innerHTML=bodyNotice(pending?"正文已抓取，中文翻译尚未完成；目前展示导读摘要。":"该来源暂未提供可获取的完整正文，当前仅有导读摘要；请通过原文链接查看。",pending?"The article has been extracted; translation is pending. The introductory summary is available below.":"Full article text could not be retrieved from this source. Only the introductory summary is available; use the original link for more.");
      $("reader-content").querySelector(".reader-excerpt").open=true;
      return;
    }
    const ids=new Set(body.blocks.map(block=>block.id));
    $("reader-content").querySelector(".reader-meta span:last-child").textContent="正文阅读 / Article reading";
    const points=(body.keyPoints||[]).filter(point=>ids.has(point.paragraphId));
    region.innerHTML=`<section class="core-points"><div class="full-section-heading"><h3>核心观点提炼 <span lang="en">Key takeaways</span></h3><span>${points.length} 条</span></div><p class="content-method">${dualText("根据正文自动选取关键句，保留来源表述；点击可定位正文。","Key sentences selected from the article, preserving the source’s claims. Select one to find its paragraph.")}</p><ol>${points.map(point=>`<li><button class="point-link" data-paragraph="${esc(point.paragraphId)}">${dualText(point.zh,point.en)}<span class="point-reference">定位原文段落 / View paragraph ↘</span></button></li>`).join("")}</ol></section><section class="article-body-section"><div class="full-section-heading"><h3>原文内容 <span lang="en">Article text</span></h3><span>${body.blocks.length} 段 / paragraphs</span></div><div class="body-toolbar" role="group" aria-label="正文语言"><button data-body-mode="bilingual" aria-pressed="true">中英对照</button><button data-body-mode="zh" aria-pressed="false">中文</button><button data-body-mode="original" aria-pressed="false">原文 / Original</button></div><p class="content-method">${dualText("保留正文段落和小标题，移除导航与广告；图片、视频和交互内容请查看原站。译文为机器翻译。","Article paragraphs and headings are retained; navigation and ads are removed. Images, videos and interactive content remain on the source website. Translations are machine-generated.")}</p><div class="body-provenance">${esc(a.company)} · ${body.author?`${esc(body.author)} · `:""}正文采集 ${esc(new Date(body.fetchedAt).toLocaleString("zh-CN"))}</div><div class="full-article-body" data-mode="bilingual">${body.blocks.map((block,index)=>{
        const tag=block.kind==="heading"?"h4":"p";
        return `<${tag} id="body-${esc(block.id)}" class="body-block ${block.kind==="heading"?"body-heading":""}" tabindex="-1"><span class="paragraph-number" aria-label="段落 ${index+1}">${String(index+1).padStart(2,"0")}</span><span class="body-translated">${dualText(block.zh,block.en)}</span><span class="body-original" lang="${esc(body.language||"en")}">${esc(block.text)}</span></${tag}>`;
      }).join("")}</div></section>`;
    const translationLabels={
      official:["正文采用发布方官方中英版本。","Article text uses the publisher’s official English and Chinese versions."],
      "official-supplemented":["正文采用发布方官方中文版本，末段引语为 AI 补译并经逐段核对。","Article text uses the publisher’s official Chinese version; the closing quotation was AI-translated and checked against the source."],
      "ai-reviewed":["正文译文由 AI 生成并逐段核对，未经人工审校。","Article translation was AI-generated and checked paragraph by paragraph, without human editorial review."]
    };
    const translationLabel=translationLabels[body.translationKind]||["正文译文为机器翻译。","Article translations are machine-generated."];
    region.querySelector(".article-body-section .content-method").innerHTML=dualText(
      `保留正文段落和小标题，移除导航与广告；图片、视频和交互内容请查看原站。${translationLabel[0]}`,
      `Article paragraphs and headings are retained; navigation and ads are removed. Images, videos and interactive content remain on the source website. ${translationLabel[1]}`
    );
    $("reader-content").querySelector(".reader-translation").innerHTML=dualText(
      `标题、导读摘要等含机器翻译。${translationLabel[0]}`,
      `Titles and introductory summaries include machine translation. ${translationLabel[1]}`
    );
    const translationURL=safeURL(body.translationSourceURL);
    if(translationURL){
      region.querySelector(".body-provenance").insertAdjacentHTML("beforeend",` · <a href="${esc(translationURL)}" target="_blank" rel="noopener noreferrer">官方中文来源 / Official Chinese version</a>`);
    }
    region.querySelectorAll("[data-paragraph]").forEach(button=>button.addEventListener("click",()=>{
      const target=$(`body-${button.dataset.paragraph}`);
      target?.scrollIntoView({behavior:"smooth",block:"start"});target?.focus({preventScroll:true});
    }));
    region.querySelectorAll("[data-body-mode]").forEach(button=>button.addEventListener("click",()=>{
      region.querySelector(".full-article-body").dataset.mode=button.dataset.bodyMode;
      region.querySelectorAll("[data-body-mode]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    }));
  }
  function validArticle(a) { return a && typeof a.id==="string" && typeof a.title==="string" && typeof a.company==="string" && Array.isArray(a.categories) && safeURL(a.url); }
  function allArticles() {
    const urls = new Set(data.articles.map(a=>safeURL(a.url).replace(/\/$/,"")));
    const records=[...data.articles,...live.filter(a=>!urls.has(safeURL(a.url).replace(/\/$/,"")))];
    const ids=new Set(records.map(a=>a.id));
    return [...records,...Object.values(personal.archived).filter(a=>validArticle(a)&&!ids.has(a.id))];
  }
  function savePersonal() {
    try { localStorage.setItem(storeKey,JSON.stringify(personal)); return true; }
    catch { storageAvailable = false; toast("本机存储不可用，当前记录仅保留到页面关闭。"); return false; }
  }
  function toast(text) { clearTimeout(toastTimer); $("toast").textContent=text; $("toast").hidden=false; toastTimer=setTimeout(()=>$("toast").hidden=true,3600); }
  function renderIcons(root = document) { root.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon)); }
  const viewInfo = {
    home:["资讯首页","看见变化，读懂组织。","从全球科技公司的新动向中，积累组织与 AI 的日常洞察。"],
    live:["订阅动态","来自一手来源的新动向。","官方订阅自动聚合，中英对照阅读；相关性和结论需结合原文判断。"],
    companies:["公司观察","沿着一家公司，持续观察。","积累事件、连接上下文，理解组织变化的来龙去脉。"],
    topics:["主题阅读","把相关的变化，放在一起读。","围绕一个问题组织阅读，让零散的信息形成联系。"],
    saved:["我的收藏","留住值得反复读的内容。","收藏跨页面保留在当前浏览器，随时回来继续阅读。"],
    history:["阅读记录","每一次阅读，都留下足迹。","记录最近打开过的文章与学习笔记，方便回顾和延伸思考。"],
    sources:["信息来源","有出处，也有边界。","查看订阅运行状态、内容更新时间，以及不同信息的证据边界。"]
  };
  function navigate(view, options={}) {
    state={...state,view,category:"全部",company:"all",period:"all",unread:false,query:"",collection:null,...options};
    syncControls(); render(); window.scrollTo({top:0,behavior:"instant"});
  }
  function syncControls() {
    $("search").value=state.query; $("company-filter").value=state.company;
    $("period-filter").value=state.period; $("unread-only").checked=state.unread; $("sort").value=state.sort;
  }
  function updateStats() {
    $("saved-count").textContent=personal.saved.length;
    const start=new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-((start.getDay()+6)%7));
    const count=Object.values(personal.reads).filter(v=>typeof v==="string"&&new Date(v)>=start).length;
    $("weekly-count").textContent=count; $("rail-weekly-count").textContent=count;
    $("week-dots").innerHTML=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=localDay(d);return `<span class="${personal.readDays.includes(key)?"done":""}" title="${key}${personal.readDays.includes(key)?" 已阅读":" 尚未阅读"}"></span>`;}).join("");
  }
  function filteredArticles() {
    let articles=state.view==="live" ? allArticles().filter(a=>a.live) : allArticles();
    if(state.view==="saved") articles=articles.filter(a=>personal.saved.includes(a.id));
    if(state.view==="history") articles=articles.filter(a=>personal.reads[a.id]);
    if(state.collection){const collection=data.collections.find(c=>c.id===state.collection);articles=articles.filter(a=>collection?.ids.includes(a.id));}
    articles=articles.filter(a=>(state.category==="全部"||a.categories.includes(state.category))&&(state.company==="all"||a.company===state.company)&&(!state.unread||!personal.reads[a.id]));
    if(state.period!=="all"){const since=new Date();since.setHours(0,0,0,0);since.setDate(since.getDate()-Number(state.period));articles=articles.filter(a=>dated(a)>=since.getTime());}
    const terms=state.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if(terms.length) articles=articles.filter(a=>{
      const entry=matchingTranslation(a);
      const text=[a.title,a.company,companyEnglish[a.company],a.summary,a.sourceTitle,...a.categories,...a.categories.map(c=>categoryEnglish[c]),...(entry?Object.values(entry.zh).flat():[]),...(entry?Object.values(entry.en).flat():[])].join(" ").toLocaleLowerCase();
      return terms.every(t=>text.includes(t));
    });
    if(state.view==="history")articles.sort((a,b)=>String(personal.reads[b.id]).localeCompare(String(personal.reads[a.id])));
    else articles.sort((a,b)=>state.sort==="newest"?dated(b)-dated(a):dated(a)-dated(b));
    return articles;
  }
  function card(a) {
    const saved=personal.saved.includes(a.id), read=Boolean(personal.reads[a.id]);
    const company=data.companies.find(c=>c.name===a.company);
    const historical=a.date && a.date.slice(0,4)<String(new Date().getFullYear());
    return `<article class="article-card"><div class="card-top"><div class="company-meta"><span class="company-monogram">${esc(company?.initial||a.company[0])}</span><div>${companyLabel(a.company)}<small>${esc(formatDate(a.date))} 发布 / Published</small></div></div><button class="icon-btn ${saved?"saved":""}" data-save="${esc(a.id)}" aria-label="${saved?"取消收藏":"收藏"}：${esc(a.title)}" aria-pressed="${saved}">${icon("bookmark")}</button></div><h3><button class="article-title" data-open="${esc(a.id)}">${articleCopy(a,"title")}</button></h3><p class="article-summary">${articleCopy(a,"summary")}</p><div class="card-tags">${a.categories.map(c=>`<span class="tag">${label(c,categoryEnglish[c])}</span>`).join("")}<span class="tag source">${label(a.type,typeEnglish[a.type])}</span>${historical?'<span class="tag archive">历史案例 / Historical case</span>':""}${a.live?'<span class="tag archive">待核验 / Unreviewed</span>':""}<span class="tag translation">${matchingTranslation(a)?"机器翻译 / Machine translation":"翻译待更新 / Translation pending"}</span></div><div class="card-bottom"><span>${articleCopy(a,"source")}</span><div class="card-bottom-right"><span class="read-state">${read?'<i class="read-dot"></i>已读 / Read':"未读 / Unread"}</span><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer" data-track="${esc(a.id)}">原文 / Source ${icon("external")}</a></div></div></article>`;
  }
  function renderEmpty() {
    let title="暂时没有符合条件的资讯", copy="换个关键词或筛选条件，再看看。";
    if(state.view==="saved"&&!personal.saved.length){title="把值得再读的内容留在这里";copy="点击资讯卡片右上角的书签，就能加入收藏。";}
    if(state.view==="history"&&!Object.keys(personal.reads).length){title="你的阅读旅程，从一篇开始";copy="打开文章后，这里会自动记录阅读足迹。";}
    if(state.view==="live"&&!live.length){title=pending?"正在检查官方订阅源":connected?"本次订阅暂无匹配资讯":staticFeed?"静态发布包暂无订阅快照":"订阅服务暂未连接";copy=pending?"首次检查可能需要十几秒，精选内容仍可正常阅读。":connected?"可查看来源状态，了解检查结果。":staticFeed?"当前发布包未包含订阅数据，精选内容仍可正常阅读。":"可以继续阅读精选内容；连接服务后可获取订阅更新。";}
    return `<div class="empty"><span>${icon("book")}</span><h3>${title}</h3><p>${copy}</p><button class="solid-button" ${state.view==="live"?'data-view="sources"':'data-reset="true"'}>${state.view==="live"?"查看来源状态":"查看全部资讯"}</button></div>`;
  }
  function renderHomeFeature() {
    const article=allArticles().sort((a,b)=>dated(b)-dated(a))[0];
    if(!article)return;
    $("hero-kind").textContent=article.live?"最新订阅 · ZH / EN":"双语精选 · ZH / EN";
    $("hero-scope").textContent=article.categories.slice(0,2).join(" × ");
    $("hero-kicker").textContent=`${article.company} · ${formatDate(article.date)} 发布`;
    $("hero-title").innerHTML=articleCopy(article,"title");
    $("hero-summary").innerHTML=articleCopy(article,"summary");
    $("hero-open").dataset.open=article.id;
    $("hero-open").disabled=false;
    $("hero-action").textContent="阅读双语 / Read";
    $("hero-boundary").textContent=article.live?"机器翻译 · 待核验":"双语整理 · 附原始来源";
  }
  function render() {
    const info=viewInfo[state.view]; $("breadcrumb-current").textContent=info[0]; $("page-title").textContent=info[1];$("page-subtitle").textContent=info[2];
    document.querySelectorAll(".nav-item").forEach(b=>{b.classList.toggle("active",b.dataset.view===state.view);b.setAttribute("aria-current",b.dataset.view===state.view?"page":"false");});
    const listView=["home","live","saved","history"].includes(state.view);
    $("home-intro").hidden=state.view!=="home"||Boolean(state.collection)||Boolean(state.company!=="all")||Boolean(state.query);
    $("feed-controls").hidden=!listView; $("feed").hidden=!listView; $("alternate-content").hidden=listView;
    $("right-rail").hidden=!listView; $("content-layout").style.gridTemplateColumns=listView?"":"1fr";
    if(listView){
      $("category-tabs").innerHTML=data.categories.map(c=>`<button data-category="${c}" class="${c===state.category?"active":""}" aria-pressed="${c===state.category}"><span>${c}</span><small lang="en">${categoryEnglish[c]}</small></button>`).join("");
      const articles=filteredArticles(), collection=data.collections.find(c=>c.id===state.collection);
      $("list-heading").firstChild.textContent=collection?`${collection.title} `:state.company!=="all"?`${state.company} · 资讯 `:state.view==="home"?"最新资讯 ":`${info[0]} `;
      $("result-count").textContent=`${articles.length} 篇`;
      $("context-note").textContent=collection?collection.description:state.view==="live"?`${connected?"自动聚合标题与摘录":staticFeed?"公网订阅快照":"当前显示本机缓存"} · 中英对照，含机器翻译 · ${pending?"正在检查更新…":"按来源发布日期排序"}`:state.view==="history"?"按最近阅读时间排序；读过的文章仍可再次打开。":`精选整理于 ${formatDate(data.curatedAt)} · 按原文发布日期展示，历史案例单独标注。`;
      if(collection)$("context-note").innerHTML=dualText(collection.description,collection.descriptionEn);
      $("feed").innerHTML=articles.length?articles.map(card).join(""):renderEmpty();
      $("feed").querySelectorAll(".article-card").forEach(element=>{
        const identifier=element.querySelector("[data-open]")?.dataset.open;
        const status=contentIndex[identifier]?.status;
        if(!status)return;
        const badge=document.createElement("span");
        badge.className="tag body-status";
        badge.textContent=status==="ready"?"站内全文 / Article text":status==="translation_pending"?"正文翻译中 / Translation pending":"仅摘要 / Summary only";
        element.querySelector(".card-tags").prepend(badge);
      });
      if(state.view==="home"&&!collection)$("context-note").textContent=`中英对照 · 含机器翻译，请以原始来源为准 · 按原文发布日期排序 / Chinese & English · Machine translations · Newest first`;
      $("sort").disabled=state.view==="history";
    }else if(state.view==="companies") renderCompanies();
    else if(state.view==="topics") renderTopics();
    else renderSources();
    renderHomeFeature();updateStats();updateCloudCopy();
  }
  function renderCompanies() {
    $("alternate-content").innerHTML=`<div class="company-grid">${data.companies.map(c=>{const n=allArticles().filter(a=>a.company===c.name).length;return `<article class="company-card"><div class="company-card-head"><span class="company-monogram">${esc(c.initial)}</span><div><h3>${companyLabel(c.name)}</h3><small>${label(c.region,c.region==="美国"?"US":"China")} · ${c.feed?"官方订阅 / Official RSS":"精选观察 / Curated"}</small></div></div><p>${dualText(c.focus,c.focusEn)}</p><small>${n?`当前收录 ${n} 篇 / ${n} articles`:"暂无收录 / No articles collected"}</small><div class="controls"><button class="text-button" data-company="${esc(c.name)}">查看资讯 ${icon("arrow")}</button><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">官方信息入口 ↗</a></div></article>`;}).join("")}</div>`;
  }
  function renderTopics() {
    $("alternate-content").innerHTML=`<div class="topic-grid">${data.collections.map((c,i)=>`<article class="topic-card"><div class="topic-number">READING PATH / 0${i+1}</div><h3>${dualText(c.title,c.titleEn)}</h3><p>${dualText(c.description,c.descriptionEn)}</p><button class="text-button" data-collection="${c.id}">${c.ids.length} 篇精选 · 开始阅读 ${icon("arrow")}</button></article>`).join("")}</div>`;
  }
  function renderSources() {
    const descriptions={microsoft:"微软官方博客",google:"Google The Keyword",openai:"OpenAI News",meta:"Meta Newsroom"};
    const feedCompanies=data.companies.filter(c=>c.feed);
    $("alternate-content").innerHTML=`<p class="sources-header">${connected?"订阅服务已连接。运行期间每 6 小时检查一次，也可以点击右上角刷新。":staticFeed?"当前为公网静态版本：显示发布时打包的订阅快照，不会在浏览者电脑上自动检查；重新发布后才会更新快照。":"订阅服务尚未连接。离线页面仍可使用精选、收藏和笔记；自动检查需要服务持续运行。"}<br>精选资料整理于 ${formatDate(data.curatedAt)}。订阅候选采用关键词匹配，不自动进入精选。</p>${feedCompanies.map(c=>{const s=sourceStates.find(s=>s.id===c.feed);return `<article class="source-row"><div class="source-row-top"><h3>${esc(descriptions[c.feed])}</h3><span class="source-status ${s?.status==="failed"?"failed":""}">${s? s.status==="ok"?"最近检查成功":"最近检查失败":pending?"等待检查":"尚未检查"}</span></div><p>${s?`最近尝试：${esc(new Date(s.attemptedAt).toLocaleString("zh-CN"))} · ${s.status==="ok"?`相关候选 ${s.count} 条`:`${esc(s.error||"连接失败")}；保留已获取内容`}`:"不会将未检查显示为没有新资讯。"}</p>${s?.lastSuccess?`<p>最近成功：${esc(new Date(s.lastSuccess).toLocaleString("zh-CN"))}</p>`:""}<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">前往官方信息入口 ↗</a></article>`;}).join("")}<div class="source-explanation"><h3>如何阅读这些信息</h3><ul><li>精选的中文摘要、阅读要点和学习启发配有英文译文，每篇附上原文与证据边界。学习启发是本站整理，不是公司的原话。</li><li>订阅展示公开 RSS 标题与短摘录，中英文同时显示。英文原文保留，中文由机器翻译；内容仍可能是宣传、预测或单方观点。</li><li>翻译可能出现术语、语气或上下文偏差，请以原始来源为准。新增或变更内容会自动翻译，翻译失败时保留上次成功发布的版本。</li><li>“发布日期”与“事件发生时间”分开记录；较早文章标为历史案例，不将其包装成今日新闻。</li><li>腾讯案例来自《中国企业家》的报道，由中国经济网转载，标为媒体报道；不等同于公司官方确认。</li><li>Anthropic、Amazon、阿里巴巴与腾讯目前采用精选资料观察，未接入自动订阅。未抓取的来源不算覆盖。</li><li>收藏、阅读足迹、笔记仅存当前浏览器；清除浏览器数据后会丢失，不跨设备同步。</li><li>${staticFeed?"静态版本不会在访问者浏览器中执行采集；订阅快照只随网站重新发布更新。":"本地服务停止或电脑休眠时不会执行更新；重新启动后会再次检查来源。"}</li></ul><p>${staticFeed?"订阅快照时间":"最近整批检查"}：${service?.lastRefresh?esc(new Date(service.lastRefresh).toLocaleString("zh-CN")):"尚未完成"}${connected&&service?.nextRefresh?` · 下次计划：${esc(new Date(service.nextRefresh).toLocaleString("zh-CN"))}`:""}</p></div>`;
  }
  function updateCloudCopy() {
    if(!cloudFeed())return;
    if(state.view==="sources"){
      const header=$("alternate-content").querySelector(".sources-header");
      if(header)header.firstChild.textContent="云端按北京时间每天 00:17、06:17、12:17、18:17 计划检查并发布，执行可能延迟。刷新按钮读取已发布数据；最近运行结果以 GitHub Actions 为准。";
      const details=$("alternate-content").querySelector(".source-explanation");
      if(details){
        details.querySelector("li:last-child").textContent="采集在云端运行，无需保持个人电脑开机。若采集或发布失败，页面保留上次成功发布的内容。";
        if(service.nextRefresh)details.querySelector("p").textContent+=` · 下次计划：${new Date(service.nextRefresh).toLocaleString("zh-CN")}（可能延迟）`;
      }
    }
    if(state.view==="live")$("context-note").textContent="云端订阅 · 点击阅读核心观点与可获取的正文 · 中英对照 / Open for key takeaways and available article text";
  }
  function markRead(id) {
    const article=allArticles().find(a=>a.id===id);if(article)personal.archived[id]={...article,bilingual:matchingTranslation(article)};
    personal.reads[id]=new Date().toISOString();
    const day=localDay();if(!personal.readDays.includes(day))personal.readDays.push(day);
    personal.readDays=personal.readDays.slice(-366);savePersonal();updateStats();
  }
  function openReader(id) {
    const a=allArticles().find(a=>a.id===id);if(!a)return;
    activeArticle=a;markRead(id);render();
    const points=Array.isArray(a.points)?a.points:[];
    $("reader-content").innerHTML=`<div class="reader-label">${companyLabel(a.company)} <span>·</span> ${label(a.type,typeEnglish[a.type])}</div><h2 id="reader-title">${articleCopy(a,"title")}</h2><div class="reader-meta"><span>发布 / Published ${esc(formatDate(a.date))}</span><span>${a.eventDate?`事件时间 / Event ${esc(formatDate(a.eventDate))}`:"事件时间未单独核验 / Event date unverified"}</span><span>${a.live?"RSS 摘录 / RSS excerpt":"精选整理 / Curated"}</span></div><p class="reader-translation">${dualText("中英对照 · 含机器翻译，请以原始来源为准。","Chinese & English · Includes machine translation; refer to the original source.")}</p><p class="reader-summary">${articleCopy(a,"summary")}</p>${points.length?`<section class="reader-section"><h3>01 / 阅读要点 · Key points</h3><ul>${points.map((p,i)=>`<li>${articleCopy(a,"points",i)}</li>`).join("")}</ul></section>`:""}${a.takeaway?`<section class="reader-section"><h3>02 / 学习启发 · 本站整理 / Editorial reflection</h3><p>${articleCopy(a,"takeaway")}</p></section>`:""}${a.question?`<section class="reader-section reader-question"><h3>留一个问题给自己 / A question to consider</h3><p>${articleCopy(a,"question")}</p></section>`:""}<section class="reader-section"><h3>信息边界 / Evidence limits</h3><p>${a.caveat?articleCopy(a,"caveat"):dualText("自动获取的官方订阅摘要，尚未经人工核验。请阅读原文确认适用范围与实际结论。","This official RSS excerpt is collected automatically and has not been reviewed by an editor. Read the original source to confirm its scope and conclusions.")}</p></section><div class="reader-source"><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">阅读原始来源 / Original source ${icon("external")}</a><div>${articleCopy(a,a.sourceTitle?"sourceTitle":"title")}<br>${articleCopy(a,"source")}</div></div><div class="reader-actions"><button class="outline-button" id="reader-save" data-save="${esc(a.id)}">${icon("bookmark")} ${personal.saved.includes(a.id)?"已收藏 · 点击取消":"收藏这篇文章"}</button><button class="outline-button" id="copy-source">${icon("link")} 复制原文链接</button></div><label class="note-label" for="article-note">我的学习笔记</label><textarea class="note-textarea" id="article-note" maxlength="5000" placeholder="记下一点启发，或一个想继续追问的问题…">${esc(typeof personal.notes[a.id]==="string"?personal.notes[a.id]:"")}</textarea><div class="note-footer"><span id="note-status">${storageAvailable?"自动保存在本机，不会发送给其他人":"本机存储不可用，仅保留当前会话"}</span><span>最多 5,000 字</span></div>`;
    prepareFullReader(a);
    $("article-note").addEventListener("input",e=>{if(e.target.value)personal.notes[a.id]=e.target.value;else delete personal.notes[a.id];const ok=savePersonal();$("note-status").textContent=ok?"已自动保存于本机":"保存不可用；请先复制笔记内容";});
    const unreadButton=document.createElement("button");
    unreadButton.className="outline-button";unreadButton.textContent="标为未读";
    unreadButton.addEventListener("click",()=>{
      delete personal.reads[a.id];
      personal.readDays=personal.readDays.filter(day=>Object.values(personal.reads).some(v=>typeof v==="string"&&localDay(new Date(v))===day));
      savePersonal();render();unreadButton.textContent="已标为未读";unreadButton.disabled=true;toast("已标为未读，下次可继续阅读");
    });
    $("reader-content").querySelector(".reader-actions").append(unreadButton);
    $("copy-source").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(a.url);toast("原文链接已复制");}catch{toast("当前环境不支持复制，可从原文链接手动复制。");}});
    if(!$("reader").open)$("reader").showModal();$("reader").scrollTop=0;
  }
  function toggleSaved(id) {
    if(personal.saved.includes(id)){personal.saved=personal.saved.filter(x=>x!==id);toast("已取消收藏");}
    else{personal.saved.push(id);const article=allArticles().find(a=>a.id===id);if(article)personal.archived[id]={...article,bilingual:matchingTranslation(article)};toast("已加入我的收藏");}
    savePersonal();render();
    if(activeArticle?.id===id&&$("reader").open){$("reader-save").innerHTML=`${icon("bookmark")} ${personal.saved.includes(id)?"已收藏 · 点击取消":"收藏这篇文章"}`;$("reader-save").setAttribute("aria-pressed",String(personal.saved.includes(id)));}
  }
  function applyFeed(payload,isStatic=false) {
    if(!Array.isArray(payload.articles))throw new Error("invalid");
    const fingerprint=JSON.stringify([isStatic,payload.deploymentMode,payload.lastRefresh,payload.refreshing,payload.sources,payload.articles.length,payload.bilingualRevision]);
    const changed=fingerprint!==serviceFingerprint||connected===isStatic;
    serviceFingerprint=fingerprint;
    connected=!isStatic;staticFeed=isStatic;pending=!isStatic&&Boolean(payload.refreshing);
    sourceStates=payload.sources||[];service=payload;
    live=payload.articles.filter(validArticle);
    try{localStorage.setItem("org-observer-live-v1",JSON.stringify(live));}catch{}
    $("sync-summary").textContent=payload.lastRefresh?`${isStatic?"公网订阅快照":"订阅最近检查"} ${new Date(payload.lastRefresh).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}`:isStatic?"公网静态版本":"正在检查订阅源";
    $("refresh").disabled=pending;$("refresh").setAttribute("aria-label",pending?"正在刷新订阅":isStatic?"读取最新发布数据":"刷新订阅");
    if(cloudFeed())$("sync-summary").textContent=`云端最近采集 ${new Date(payload.lastRefresh).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}`;
    if(changed)render();clearTimeout(pollTimer);
    if(pending)pollTimer=setTimeout(readService,2500);
    return true;
  }
  async function loadStaticFeed() {
    try {
      const [response,translated]=await Promise.all([
        fetch("./feed.json",{cache:"no-store",signal:AbortSignal.timeout(10000)}),
        fetch("./bilingual.json",{cache:"no-store",signal:AbortSignal.timeout(10000)})
      ]);
      if(!response.ok||!translated.ok)throw new Error("static");
      const [payload,bundle]=await Promise.all([response.json(),translated.json()]);
      if(bundle.schemaVersion!==1||bundle.revision!==payload.bilingualRevision||!Array.isArray(payload.articles))throw new Error("translation snapshot mismatch");
      if([...data.articles,...payload.articles].some(a=>!matchingTranslation(a,bundle)))throw new Error("incomplete translation");
      translations=bundle;
      try{localStorage.setItem("org-observer-bilingual-v1",JSON.stringify(bundle));}catch{}
      const applied=applyFeed(payload,true);
      loadContentIndex();
      return applied;
    }catch{connected=false;pending=false;$("refresh").disabled=false;$("sync-summary").textContent="读取更新失败 · 当前显示已有内容";if(state.view==="live"||state.view==="sources")render();return false;}
  }
  async function readService() {
    if(location.protocol==="file:")return false;
    if(publicSite||staticFeed)return loadStaticFeed();
    try {
      const response=await fetch("/api/feed",{signal:AbortSignal.timeout(7000)});
      if(response.status===404||response.status===405||response.status===501)return loadStaticFeed();
      if(!response.ok)throw new Error("service");
      return applyFeed(await response.json(),false);
    }catch{connected=false;pending=false;$("refresh").disabled=false;return loadStaticFeed();}
  }
  async function refresh() {
    if(location.protocol==="file:"){toast("离线模式可阅读精选；订阅更新需要启动本地服务。");return;}
    if(publicSite||staticFeed){
      $("refresh").disabled=true;
      const previous=service?.lastRefresh;
      const ok=await loadStaticFeed();
      toast(ok?(previous===service?.lastRefresh?"已是最新发布的数据":"已读取最新发布的数据"):"暂时无法读取更新，已有内容仍可阅读。");
      return;
    }
    $("refresh").disabled=true;
    try {
      const r=await fetch("/api/refresh",{method:"POST",headers:{"X-Org-Observer":"1"},signal:AbortSignal.timeout(5000)});
      if(!r.ok)throw new Error("refresh");toast("已开始检查官方订阅源");await readService();
    }catch{$("refresh").disabled=false;toast("暂时无法连接订阅服务，已有内容仍可阅读。");}
  }
  document.addEventListener("click",e=>{
    const button=e.target.closest("button,a");if(!button)return;
    if(button.dataset.view){navigate(button.dataset.view);return;}
    if(button.dataset.open){openReader(button.dataset.open);return;}
    if(button.dataset.save){toggleSaved(button.dataset.save);return;}
    if(button.dataset.track){markRead(button.dataset.track);return;}
    if(button.dataset.category){state.category=button.dataset.category;render();return;}
    if(button.dataset.categoryShortcut){navigate("home",{category:button.dataset.categoryShortcut});return;}
    if(button.dataset.companyShortcut){navigate("home",{company:button.dataset.companyShortcut});return;}
    if(button.dataset.company){navigate("home",{company:button.dataset.company});return;}
    if(button.dataset.collection){navigate("home",{collection:button.dataset.collection});return;}
    if(button.dataset.reset){navigate("home");return;}
  });
  $("close-reader").addEventListener("click",()=>$("reader").close());
  $("reader").addEventListener("click",e=>{if(e.target===$("reader")){const r=$("reader").getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$("reader").close();}});
  $("reader").addEventListener("close",()=>{activeArticle=null;bodyRequest?.abort();});
  $("search").addEventListener("input",e=>{state.query=e.target.value;if(!["home","live","saved","history"].includes(state.view))state.view="home";render();});
  $("company-filter").addEventListener("change",e=>{state.company=e.target.value;render();});
  $("period-filter").addEventListener("change",e=>{state.period=e.target.value;render();});
  $("unread-only").addEventListener("change",e=>{state.unread=e.target.checked;render();});
  $("sort").addEventListener("change",e=>{state.sort=e.target.value;render();});
  $("clear-filters").addEventListener("click",()=>{state={...state,category:"全部",company:"all",period:"all",unread:false,query:"",collection:null};syncControls();render();});
  $("refresh").addEventListener("click",refresh);
  document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if($("reader").open)$("reader").close();$("search").focus();}});
  $("company-filter").innerHTML+=[...data.companies].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
  $("date-line").textContent=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})+"  /  DAILY READING";
  renderIcons();render();readService();
  setInterval(()=>{if(!document.hidden&&!pending)readService();},60000);
  if(!storageAvailable)toast("本机存储不可用，收藏与笔记仅保留在当前页面。");
})();
