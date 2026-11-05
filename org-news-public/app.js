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
  let state = {view:"home",category:"全部",company:"all",period:"all",unread:false,query:"",sort:"newest",collection:null,includeLive:false};
  let live = [], sourceStates = [], service = null, connected = false, staticFeed = false, pending = false, toastTimer, pollTimer, activeArticle = null, serviceFingerprint = "";
  const cloudFeed = () => staticFeed && service?.deploymentMode === "github-actions";
  try { const cached = JSON.parse(localStorage.getItem("org-observer-live-v1") || "[]"); if(Array.isArray(cached)) live = cached.filter(validArticle); } catch {}
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
    live:["订阅动态","来自一手来源的新动向。","官方订阅自动聚合，保留原文标题与摘录；相关性和结论需结合原文判断。"],
    companies:["公司观察","沿着一家公司，持续观察。","积累事件、连接上下文，理解组织变化的来龙去脉。"],
    topics:["主题阅读","把相关的变化，放在一起读。","围绕一个问题组织阅读，让零散的信息形成联系。"],
    saved:["我的收藏","留住值得反复读的内容。","收藏跨页面保留在当前浏览器，随时回来继续阅读。"],
    history:["阅读记录","每一次阅读，都留下足迹。","记录最近打开过的文章与学习笔记，方便回顾和延伸思考。"],
    sources:["信息来源","有出处，也有边界。","查看订阅运行状态、内容更新时间，以及不同信息的证据边界。"]
  };
  function navigate(view, options={}) {
    state={...state,view,category:"全部",company:"all",period:"all",unread:false,query:"",collection:null,includeLive:false,...options};
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
    let articles=state.view==="home" ? (state.includeLive?allArticles():data.articles) : state.view==="live" ? allArticles().filter(a=>a.live) : allArticles();
    if(state.view==="saved") articles=articles.filter(a=>personal.saved.includes(a.id));
    if(state.view==="history") articles=articles.filter(a=>personal.reads[a.id]);
    if(state.collection){const collection=data.collections.find(c=>c.id===state.collection);articles=articles.filter(a=>collection?.ids.includes(a.id));}
    articles=articles.filter(a=>(state.category==="全部"||a.categories.includes(state.category))&&(state.company==="all"||a.company===state.company)&&(!state.unread||!personal.reads[a.id]));
    if(state.period!=="all"){const since=new Date();since.setHours(0,0,0,0);since.setDate(since.getDate()-Number(state.period));articles=articles.filter(a=>dated(a)>=since.getTime());}
    const terms=state.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if(terms.length) articles=articles.filter(a=>terms.every(t=>[a.title,a.company,a.summary,...a.categories].join(" ").toLocaleLowerCase().includes(t)));
    if(state.view==="history")articles.sort((a,b)=>String(personal.reads[b.id]).localeCompare(String(personal.reads[a.id])));
    else articles.sort((a,b)=>state.sort==="newest"?dated(b)-dated(a):dated(a)-dated(b));
    return articles;
  }
  function card(a) {
    const saved=personal.saved.includes(a.id), read=Boolean(personal.reads[a.id]);
    const company=data.companies.find(c=>c.name===a.company);
    const historical=a.date && a.date.slice(0,4)<String(new Date().getFullYear());
    return `<article class="article-card"><div class="card-top"><div class="company-meta"><span class="company-monogram">${esc(company?.initial||a.company[0])}</span><div>${esc(a.company)}<small>${esc(formatDate(a.date))} 发布</small></div></div><button class="icon-btn ${saved?"saved":""}" data-save="${esc(a.id)}" aria-label="${saved?"取消收藏":"收藏"}：${esc(a.title)}" aria-pressed="${saved}">${icon("bookmark")}</button></div><h3><button class="article-title" data-open="${esc(a.id)}">${esc(a.title)}</button></h3><p class="article-summary">${esc(a.summary)}</p><div class="card-tags">${a.categories.map(c=>`<span class="tag">${esc(c)}</span>`).join("")}<span class="tag source">${esc(a.type)}</span>${historical?'<span class="tag archive">历史案例</span>':""}${a.live?'<span class="tag archive">自动聚合 · 待阅读</span>':""}</div><div class="card-bottom"><span>${esc(a.source)}</span><div class="card-bottom-right"><span class="read-state">${read?'<i class="read-dot"></i>已读':"未读"}</span><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer" data-track="${esc(a.id)}">原文 ${icon("external")}</a></div></div></article>`;
  }
  function renderEmpty() {
    let title="暂时没有符合条件的资讯", copy="换个关键词或筛选条件，再看看。";
    if(state.view==="saved"&&!personal.saved.length){title="把值得再读的内容留在这里";copy="点击资讯卡片右上角的书签，就能加入收藏。";}
    if(state.view==="history"&&!Object.keys(personal.reads).length){title="你的阅读旅程，从一篇开始";copy="打开文章后，这里会自动记录阅读足迹。";}
    if(state.view==="live"&&!live.length){title=pending?"正在检查官方订阅源":connected?"本次订阅暂无匹配资讯":staticFeed?"静态发布包暂无订阅快照":"订阅服务暂未连接";copy=pending?"首次检查可能需要十几秒，精选内容仍可正常阅读。":connected?"可查看来源状态，了解检查结果。":staticFeed?"当前发布包未包含订阅数据，精选内容仍可正常阅读。":"可以继续阅读精选内容；连接服务后可获取订阅更新。";}
    return `<div class="empty"><span>${icon("book")}</span><h3>${title}</h3><p>${copy}</p><button class="solid-button" ${state.view==="live"?'data-view="sources"':'data-reset="true"'}>${state.view==="live"?"查看来源状态":"回到全部精选"}</button></div>`;
  }
  function render() {
    const info=viewInfo[state.view]; $("breadcrumb-current").textContent=info[0]; $("page-title").textContent=info[1];$("page-subtitle").textContent=info[2];
    document.querySelectorAll(".nav-item").forEach(b=>{b.classList.toggle("active",b.dataset.view===state.view);b.setAttribute("aria-current",b.dataset.view===state.view?"page":"false");});
    const listView=["home","live","saved","history"].includes(state.view);
    $("home-intro").hidden=state.view!=="home"||Boolean(state.collection)||Boolean(state.company!=="all")||Boolean(state.query);
    $("feed-controls").hidden=!listView; $("feed").hidden=!listView; $("alternate-content").hidden=listView;
    $("right-rail").hidden=!listView; $("content-layout").style.gridTemplateColumns=listView?"":"1fr";
    if(listView){
      $("category-tabs").innerHTML=data.categories.map(c=>`<button data-category="${c}" class="${c===state.category?"active":""}" aria-pressed="${c===state.category}">${c}</button>`).join("");
      const articles=filteredArticles(), collection=data.collections.find(c=>c.id===state.collection);
      $("list-heading").firstChild.textContent=collection?`${collection.title} `:state.company!=="all"?`${state.company} · 资讯 `:state.view==="home"?"精选资讯 ":`${info[0]} `;
      $("result-count").textContent=`${articles.length} 篇`;
      $("context-note").textContent=collection?collection.description:state.view==="live"?`${connected?"自动聚合原文标题与摘录":staticFeed?"公网静态快照":"当前显示本机缓存"} · 不自动翻译、不代表编辑核验 · ${pending?"正在检查更新…":"按来源发布日期排序"}`:state.view==="history"?"按最近阅读时间排序；读过的文章仍可再次打开。":`精选整理于 ${formatDate(data.curatedAt)} · 按原文发布日期展示，历史案例单独标注。`;
      $("feed").innerHTML=articles.length?articles.map(card).join(""):renderEmpty();
      if(state.includeLive)$("context-note").textContent="公司全部收录 · 包含中文精选与官方订阅摘录，信息类型分别标注。";
      $("sort").disabled=state.view==="history";
    }else if(state.view==="companies") renderCompanies();
    else if(state.view==="topics") renderTopics();
    else renderSources();
    updateStats();updateCloudCopy();
  }
  function renderCompanies() {
    $("alternate-content").innerHTML=`<div class="company-grid">${data.companies.map(c=>{const n=allArticles().filter(a=>a.company===c.name).length;return `<article class="company-card"><div class="company-card-head"><span class="company-monogram">${esc(c.initial)}</span><div><h3>${esc(c.name)}</h3><small>${esc(c.region)} · ${c.feed?"官方订阅 + 资料观察":"精选资料观察"}</small></div></div><p>${esc(c.focus)}</p><small>${n?`当前收录 ${n} 篇`:"暂无收录，不代表没有变化"}</small><div class="controls"><button class="text-button" data-company="${esc(c.name)}">查看资讯 ${icon("arrow")}</button><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">官方信息入口 ↗</a></div></article>`;}).join("")}</div>`;
  }
  function renderTopics() {
    $("alternate-content").innerHTML=`<div class="topic-grid">${data.collections.map((c,i)=>`<article class="topic-card"><div class="topic-number">READING PATH / 0${i+1}</div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><button class="text-button" data-collection="${c.id}">${c.ids.length} 篇精选 · 开始阅读 ${icon("arrow")}</button></article>`).join("")}</div>`;
  }
  function renderSources() {
    const descriptions={microsoft:"微软官方博客",google:"Google The Keyword",openai:"OpenAI News",meta:"Meta Newsroom"};
    const feedCompanies=data.companies.filter(c=>c.feed);
    $("alternate-content").innerHTML=`<p class="sources-header">${connected?"订阅服务已连接。运行期间每 6 小时检查一次，也可以点击右上角刷新。":staticFeed?"当前为公网静态版本：显示发布时打包的订阅快照，不会在浏览者电脑上自动检查；重新发布后才会更新快照。":"订阅服务尚未连接。离线页面仍可使用精选、收藏和笔记；自动检查需要服务持续运行。"}<br>精选资料整理于 ${formatDate(data.curatedAt)}。订阅候选采用关键词匹配，不自动进入精选。</p>${feedCompanies.map(c=>{const s=sourceStates.find(s=>s.id===c.feed);return `<article class="source-row"><div class="source-row-top"><h3>${esc(descriptions[c.feed])}</h3><span class="source-status ${s?.status==="failed"?"failed":""}">${s? s.status==="ok"?"最近检查成功":"最近检查失败":pending?"等待检查":"尚未检查"}</span></div><p>${s?`最近尝试：${esc(new Date(s.attemptedAt).toLocaleString("zh-CN"))} · ${s.status==="ok"?`相关候选 ${s.count} 条`:`${esc(s.error||"连接失败")}；保留已获取内容`}`:"不会将未检查显示为没有新资讯。"}</p>${s?.lastSuccess?`<p>最近成功：${esc(new Date(s.lastSuccess).toLocaleString("zh-CN"))}</p>`:""}<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">前往官方信息入口 ↗</a></article>`;}).join("")}<div class="source-explanation"><h3>如何阅读这些信息</h3><ul><li>精选采用中文编写的摘要，每篇附上原文与证据边界。学习启发是本站整理，不是公司的原话。</li><li>订阅展示公开 RSS 标题与短摘录，保留原文语言。来源来自官方网站，内容本身仍可能是宣传、预测或单方观点。</li><li>“发布日期”与“事件发生时间”分开记录；较早文章标为历史案例，不将其包装成今日新闻。</li><li>腾讯案例来自《中国企业家》的报道，由中国经济网转载，标为媒体报道；不等同于公司官方确认。</li><li>Anthropic、Amazon、阿里巴巴与腾讯目前采用精选资料观察，未接入自动订阅。未抓取的来源不算覆盖。</li><li>收藏、阅读足迹、笔记仅存当前浏览器；清除浏览器数据后会丢失，不跨设备同步。</li><li>${staticFeed?"静态版本不会在访问者浏览器中执行采集；订阅快照只随网站重新发布更新。":"本地服务停止或电脑休眠时不会执行更新；重新启动后会再次检查来源。"}</li></ul><p>${staticFeed?"订阅快照时间":"最近整批检查"}：${service?.lastRefresh?esc(new Date(service.lastRefresh).toLocaleString("zh-CN")):"尚未完成"}${connected&&service?.nextRefresh?` · 下次计划：${esc(new Date(service.nextRefresh).toLocaleString("zh-CN"))}`:""}</p></div>`;
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
    if(state.view==="live")$("context-note").textContent="云端订阅快照 · 不自动翻译、不代表编辑核验 · 按来源发布日期排序";
  }
  function markRead(id) {
    const article=allArticles().find(a=>a.id===id);if(article)personal.archived[id]=article;
    personal.reads[id]=new Date().toISOString();
    const day=localDay();if(!personal.readDays.includes(day))personal.readDays.push(day);
    personal.readDays=personal.readDays.slice(-366);savePersonal();updateStats();
  }
  function openReader(id) {
    const a=allArticles().find(a=>a.id===id);if(!a)return;
    activeArticle=a;markRead(id);render();
    const points=Array.isArray(a.points)?a.points:[];
    $("reader-content").innerHTML=`<div class="reader-label">${esc(a.company)} <span>·</span> ${esc(a.type)}</div><h2 id="reader-title">${esc(a.title)}</h2><div class="reader-meta"><span>发布 ${esc(formatDate(a.date))}</span><span>${a.eventDate?`事件时间 ${esc(formatDate(a.eventDate))}`:"事件时间未单独核验"}</span><span>${a.live?"RSS 原文摘录":"中文整理"}</span></div><p class="reader-summary">${esc(a.summary)}</p>${points.length?`<section class="reader-section"><h3>01 / 阅读要点</h3><ul>${points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></section>`:""}${a.takeaway?`<section class="reader-section"><h3>02 / 学习启发 · 本站整理</h3><p>${esc(a.takeaway)}</p></section>`:""}${a.question?`<section class="reader-section reader-question"><h3>留一个问题给自己</h3><p>${esc(a.question)}</p></section>`:""}<section class="reader-section"><h3>信息边界</h3><p>${esc(a.caveat||"自动获取的官方订阅摘要，尚未经人工核验和翻译。请阅读原文确认适用范围与实际结论。")}</p></section><div class="reader-source"><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">阅读原始来源 ${icon("external")}</a><div>${esc(a.sourceTitle||a.title)}<br>${esc(a.source)}</div></div><div class="reader-actions"><button class="outline-button" id="reader-save" data-save="${esc(a.id)}">${icon("bookmark")} ${personal.saved.includes(a.id)?"已收藏 · 点击取消":"收藏这篇文章"}</button><button class="outline-button" id="copy-source">${icon("link")} 复制原文链接</button></div><label class="note-label" for="article-note">我的学习笔记</label><textarea class="note-textarea" id="article-note" maxlength="5000" placeholder="记下一点启发，或一个想继续追问的问题…">${esc(typeof personal.notes[a.id]==="string"?personal.notes[a.id]:"")}</textarea><div class="note-footer"><span id="note-status">${storageAvailable?"自动保存在本机，不会发送给其他人":"本机存储不可用，仅保留当前会话"}</span><span>最多 5,000 字</span></div>`;
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
    else{personal.saved.push(id);const article=allArticles().find(a=>a.id===id);if(article)personal.archived[id]=article;toast("已加入我的收藏");}
    savePersonal();render();
    if(activeArticle?.id===id&&$("reader").open){$("reader-save").innerHTML=`${icon("bookmark")} ${personal.saved.includes(id)?"已收藏 · 点击取消":"收藏这篇文章"}`;$("reader-save").setAttribute("aria-pressed",String(personal.saved.includes(id)));}
  }
  function applyFeed(payload,isStatic=false) {
    if(!Array.isArray(payload.articles))throw new Error("invalid");
    const fingerprint=JSON.stringify([isStatic,payload.deploymentMode,payload.lastRefresh,payload.refreshing,payload.sources,payload.articles.length]);
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
      const response=await fetch("./feed.json",{cache:"no-store",signal:AbortSignal.timeout(7000)});
      if(!response.ok)throw new Error("static");
      return applyFeed(await response.json(),true);
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
    if(button.dataset.companyShortcut){navigate("home",{company:button.dataset.companyShortcut,includeLive:true});return;}
    if(button.dataset.company){navigate("home",{company:button.dataset.company,includeLive:true});return;}
    if(button.dataset.collection){navigate("home",{collection:button.dataset.collection});return;}
    if(button.dataset.reset){navigate("home");return;}
  });
  $("close-reader").addEventListener("click",()=>$("reader").close());
  $("reader").addEventListener("click",e=>{if(e.target===$("reader")){const r=$("reader").getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$("reader").close();}});
  $("reader").addEventListener("close",()=>activeArticle=null);
  $("search").addEventListener("input",e=>{state.query=e.target.value;if(!["home","live","saved","history"].includes(state.view))state.view="home";render();});
  $("company-filter").addEventListener("change",e=>{state.company=e.target.value;render();});
  $("period-filter").addEventListener("change",e=>{state.period=e.target.value;render();});
  $("unread-only").addEventListener("change",e=>{state.unread=e.target.checked;render();});
  $("sort").addEventListener("change",e=>{state.sort=e.target.value;render();});
  $("clear-filters").addEventListener("click",()=>{state={...state,category:"全部",company:"all",period:"all",unread:false,query:"",collection:null,includeLive:false};syncControls();render();});
  $("refresh").addEventListener("click",refresh);
  document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if($("reader").open)$("reader").close();$("search").focus();}});
  $("company-filter").innerHTML+=[...data.companies].map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
  $("date-line").textContent=new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})+"  /  DAILY READING";
  renderIcons();render();readService();
  setInterval(()=>{if(!document.hidden&&!pending)readService();},60000);
  if(!storageAvailable)toast("本机存储不可用，收藏与笔记仅保留在当前页面。");
})();
