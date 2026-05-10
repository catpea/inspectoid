// =============================================================================
// imports.js
//
// `<import src="./foo.xml" />` - the XML modularity primitive.
//
// Why this matters:
//   * One huge document is unreadable. We let authors split a Galath app
//     across files the same way ES modules let you split a JS app.
//   * Components live alongside their styles and their data, in their own
//     files, in their own folders.
//   * The playground depends on this: each tutorial chapter is a separate
//     XML file imported into the shell.
//
// How it works:
//
//   1. Walk every `<import src="...">` in the document, top-down.
//   2. Fetch the URL relative to either the importing document's URL (for
//      nested imports) or `document.baseURI` (for the entry source).
//   3. Parse the fetched XML.
//   4. The fetched document's *root* may be either:
//        - `<galath>` - a root with multiple children, all of which are
//          spliced in at the import point;
//        - or any single element, which is also spliced in.
//   5. Replace the `<import>` element with those nodes.
//   6. Recurse into the freshly inlined nodes (their imports are still to
//      be resolved). Cycles are caught by URL: if a URL is already on the
//      resolution stack, skip the re-import.
//
// The fetch is gated on a Map keyed by absolute URL. Repeated imports of
// the same file (e.g. a shared header component) reuse the parsed source.
//
// Errors during fetch produce a clear console error AND inject a small
// `<parseerror>` element so the page surfaces the failure visibly rather
// than silently dropping content.
// =============================================================================

export function importFeature(language) {
  // url -> Promise<DocumentFragment-like Element[]>. Cached so duplicate
  // imports re-use one network round-trip.
  const cache = new Map();

  language.resolveImports = async () => {
    if (!language.document) return;
    // Track the resolution stack to break cycles. Keys are absolute URLs.
    const stack = new Set();
    await resolveContainer(language.document.documentElement, document.baseURI, stack);
  };

  /**
   * Recursively resolve `<import>` elements that are direct or transitive
   * children of `container`. We snapshot the list of imports first because
   * we mutate the DOM as we go.
   *
   * `baseUrl` is the URL relative to which `<import src>` is resolved -
   * typically the URL of the document `container` came from.
   */
  async function resolveContainer(container, baseUrl, stack) {
    // Snapshot of all imports anywhere in the subtree, in document order.
    // We process them sequentially so error handling is straightforward.
    const imports = [...container.querySelectorAll('import[src]')];
    for (const importEl of imports) {
      // Skip imports nested inside CDATA/code samples - they live in text,
      // not in real DOM nodes, so they wouldn't be caught here anyway.
      // Skip imports that are themselves still in the document but were
      // already replaced as part of resolving an outer import.
      if (!importEl.isConnected || !importEl.parentNode) continue;
      const src = importEl.getAttribute('src');
      if (!src) continue;
      const url = new URL(src, baseUrl).toString();

      // Cycle? Replace with an empty marker so future passes ignore it.
      if (stack.has(url)) {
        console.warn(`[galath import] cycle detected, skipping ${url}`);
        importEl.replaceWith(...[]);
        continue;
      }

      try {
        const nodes = await loadImport(url);
        // Recurse into the fetched fragment first - so its own <import>s
        // resolve against its URL, not ours.
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            stack.add(url);
            await resolveContainer(node, url, stack);
            stack.delete(url);
          }
        }
        // Splice the resolved nodes in place of the <import> element.
        // We import them into the host document so namespaces are preserved.
        const owner = importEl.ownerDocument;
        const adopted = nodes.map(n => owner.importNode(n, true));
        importEl.replaceWith(...adopted);
      } catch (error) {
        console.error(`[galath import] failed to load ${url}:`, error);
        const errorEl = importEl.ownerDocument.createElement('parseerror');
        errorEl.textContent = `Failed to import ${url}: ${error.message}`;
        importEl.replaceWith(errorEl);
      }
    }
  }

  /**
   * Fetch and parse an XML import. Returns the children of the fetched
   * document's root element (or `[root]` when the root is not a wrapper
   * like `<galath>` / `<fragment>`).
   *
   * Cached by URL.
   */
  function loadImport(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = (async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) throw new Error(err.textContent.trim());
      const root = doc.documentElement;
      // Wrapper roots - their *children* are what we splice. Otherwise
      // splice the root itself.
      const wrapperNames = new Set(['galath', 'fragment', 'xes']);
      return wrapperNames.has(root.localName)
        ? [...root.children]
        : [root];
    })();
    cache.set(url, promise);
    return promise;
  }
}
