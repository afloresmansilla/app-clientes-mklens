const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A"]);

export function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeDescriptionHtml(html) {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  function clean(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
        return;
      }
      [...child.attributes].forEach((attr) => {
        const keepHref =
          child.tagName === "A" &&
          attr.name === "href" &&
          /^https?:\/\//i.test(attr.value);
        if (!keepHref) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }
      clean(child);
    });
  }
  clean(doc.body);
  return doc.body.innerHTML;
}

const SKIP_FACT_LABEL = /^(fuente|source|fonte|origine|sorgente)\b/i;

function parseFactParagraph(el) {
  if (!el || el.tagName !== "P") return null;
  const text = stripHtml(el.textContent);
  if (!text || text.length >= 140) return null;
  const first = el.firstElementChild;
  const startsBold =
    first &&
    (first.tagName === "STRONG" || first.tagName === "B") &&
    el.childNodes[0] === first;
  if (!startsBold) return null;
  const colon = text.search(/[:：]/);
  if (colon < 1 || colon > 48) return null;
  const label = text.slice(0, colon).trim();
  const value = text.slice(colon + 1).trim();
  if (!label || !value) return null;
  return { label, value };
}

export function splitDescriptionHtml(html) {
  const sanitized = sanitizeDescriptionHtml(html);
  if (!sanitized || typeof window === "undefined") return { body: "", facts: [] };
  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const hasLooseText = [...doc.body.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
  );
  if (hasLooseText || !doc.body.children.length) return { body: sanitized, facts: [] };
  const facts = [];
  const bodyNodes = [];
  [...doc.body.children].forEach((el) => {
    const parsed = parseFactParagraph(el);
    if (!parsed) {
      bodyNodes.push(el.outerHTML);
      return;
    }
    if (SKIP_FACT_LABEL.test(parsed.label)) return;
    facts.push(parsed);
  });
  return { body: bodyNodes.join(""), facts };
}
