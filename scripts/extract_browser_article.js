// Read-only extraction for manually recovering public article pages in a browser.
// Call extractBrowserArticle(start, end) in the page, then archive the result.
function extractBrowserArticle(start = 0, end = 35) {
  const article = document.querySelector("article");
  if (!article) return { error: "article_element_missing", url: location.href, title: document.title };
  const candidates = [...article.children].filter(e =>
    !e.querySelector("h1") && e.tagName !== "SECTION"
  );
  const root = candidates.sort((a, b) => b.textContent.length - a.textContent.length)[0];
  if (!root) return { error: "article_body_missing", url: location.href, title: document.title };
  const blocks = [...root.querySelectorAll("h2,h3,h4,p,li,blockquote,pre,tr,figcaption")]
    .filter(e => !e.closest("nav") && !e.querySelector("p,li,blockquote") && e.textContent.trim())
    .map(e => ({
      kind: /^H/.test(e.tagName) ? "heading" : e.tagName === "LI" ? "list" : "paragraph",
      text: e.textContent.replace(/\s+/g, " ").trim(),
    }));
  const chunk = [];
  let bytes = 0;
  for (const block of blocks.slice(start, end)) {
    const size = new TextEncoder().encode(JSON.stringify(block)).length;
    if (chunk.length && bytes + size > 12000) break;
    chunk.push(block);
    bytes += size;
  }
  return {
    url: location.href,
    title: document.querySelector("h1")?.textContent?.trim() || document.title,
    language: document.documentElement.lang,
    blockCount: blocks.length,
    blocks: chunk,
    nextStart: start + chunk.length,
    lastText: blocks.at(-1)?.text.slice(-200),
  };
}
