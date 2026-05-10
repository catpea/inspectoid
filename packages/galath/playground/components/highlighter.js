// =============================================================================
// playground/components/highlighter.js
//
// Dependency-free XML syntax highlighter for the playground's <pre.xes-code>
// listings. Replaces text inside <code> with a small set of <span>s and then
// stamps `data-xes-frozen` on the <code> element so the morpher in
// packages/galath/src/morph.js leaves it alone on subsequent renders.
//
// Runs as a single MutationObserver against the playground mount. Each time
// the morpher injects a fresh <code>, we highlight it once. Snippet content
// in chapters is static (declared as a CDATA signal) so re-highlighting is
// not needed.
// =============================================================================

const TAG_RE = /^(<\/?)([\w:-]+)([\s\S]*?)(\/?>)$/;
const ATTR_RE = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightTag(tag) {
  const m = tag.match(TAG_RE);
  if (!m) return escape(tag);
  const [, opener, name, body, closer] = m;
  const attrHtml = body.replace(
    ATTR_RE,
    (_, attrName, value) =>
      ` <span class="hl-an">${escape(attrName)}</span>=<span class="hl-av">${escape(value)}</span>`,
  );
  return (
    `<span class="hl-pn">${escape(opener)}</span>` +
    `<span class="hl-tn">${escape(name)}</span>` +
    attrHtml +
    `<span class="hl-pn">${escape(closer)}</span>`
  );
}

function highlightText(text) {
  // Split on `{expr}` interpolations so they pop visually inside text runs.
  if (!text.includes('{')) return escape(text);
  return text.replace(/(\{[^}]+\})|([^{]+)/g, (_, brace, plain) =>
    brace ? `<span class="hl-itp">${escape(brace)}</span>` : escape(plain || ''),
  );
}

export function highlightXml(src) {
  let html = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      const slice = end >= 0 ? src.slice(i, end + 3) : src.slice(i);
      html += `<span class="hl-cm">${escape(slice)}</span>`;
      i += slice.length;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i);
      const slice = end >= 0 ? src.slice(i, end + 3) : src.slice(i);
      html += `<span class="hl-cd">${escape(slice)}</span>`;
      i += slice.length;
      continue;
    }
    if (src[i] === '<') {
      const close = src.indexOf('>', i);
      if (close < 0) {
        html += escape(src.slice(i));
        break;
      }
      html += highlightTag(src.slice(i, close + 1));
      i = close + 1;
      continue;
    }
    const next = src.indexOf('<', i);
    const text = next < 0 ? src.slice(i) : src.slice(i, next);
    html += highlightText(text);
    i = next < 0 ? src.length : next;
  }
  return html;
}

function highlightOnce(codeEl) {
  if (codeEl.dataset.xesHighlighted) return;
  const source = codeEl.textContent;
  codeEl.innerHTML = highlightXml(source);
  codeEl.dataset.xesHighlighted = '1';
  codeEl.setAttribute('data-xes-frozen', '1');
}

export function attachHighlighter(root) {
  const sweep = (target) => {
    const codes = target.querySelectorAll?.(
      'pre.xes-code > code:not([data-xes-highlighted])',
    );
    if (codes) for (const c of codes) highlightOnce(c);
  };
  sweep(root);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) sweep(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
