import { Defuddle } from "defuddle/node";
import { JSDOM, VirtualConsole } from "jsdom";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { html, url } = JSON.parse(input);
const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
// No scripts, page resources or external extraction APIs are executed.
const result = await Defuddle(dom.window.document, url, {
  useAsync: false, removeImages: true, separateMarkdown: true,
});
const cleaned = new JSDOM(result.content);
const root = cleaned.window.document.body;
root.querySelectorAll("script,style,nav,footer,form,button,iframe").forEach(el => el.remove());
const blocks = [];
function walk(node) {
  const tag = node.tagName?.toLowerCase();
  const text = node.textContent?.replace(/\s+/g, " ").trim();
  if (!text) return;
  if (/^h[1-6]$/.test(tag)) {
    blocks.push({ kind: "heading", text });
  } else if (["p","li","blockquote","pre","tr","figcaption"].includes(tag)) {
    // Containers can wrap several paragraphs: preserve them individually.
    if (node.querySelector("p,li") && !["tr","pre"].includes(tag)) {
      for (const child of node.children) walk(child);
    } else {
      const content = tag === "tr" ? [...node.children].map(c=>c.textContent.trim()).join(" | ") : text;
      blocks.push({ kind: tag === "li" ? "list" : tag === "figcaption" ? "caption" : "paragraph", text: content });
    }
  } else {
    let inline="";
    const flush=()=>{if(inline.trim())blocks.push({kind:"paragraph",text:inline.replace(/\s+/g," ").trim()});inline="";};
    for (const child of node.childNodes) {
      if (child.nodeType === 3) inline+=child.textContent;
      else if(child.nodeType === 1){
        if(/^(?:div|section|article|main|p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|figure|figcaption)$/.test(child.tagName.toLowerCase())){
          flush();walk(child);
        }else inline+=child.textContent;
      }
    }
    flush();
  }
}
walk(root);
process.stdout.write(JSON.stringify({
  title: result.title, author: result.author, language: result.language || dom.window.document.documentElement.lang || "en",
  published: result.published, blocks,
}));
dom.window.close();
cleaned.window.close();
