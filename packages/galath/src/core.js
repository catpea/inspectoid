// =============================================================================
// core.js
//
// Defines the language *kernel*: a tiny dependency-injection container that
// "features" plug into. Each feature attaches its own functions and classes
// onto the language object. We pick the order at boot time, so a downstream
// project can swap, omit, or extend features without forking the runtime.
//
// This file deliberately stays small. It is the only thing that knows
// nothing about XML, signals, components, or DOM. Everything else is a
// feature plugged in via `.use(...)`.
//
// Public exports:
//
//   createLanguage({ source, mount })  - Construct an empty language.
//   coreFeature(language)              - Wires up XML parsing + small helpers.
//
// =============================================================================

/**
 * Create a brand-new Galath language container.
 *
 * Because each call returns a fresh object (no shared state), you can run
 * multiple Galath apps on the same page if you want.
 *
 * @param {object} options
 * @param {string} options.source  - The Galath XML source as a string.
 * @param {Element} options.mount  - DOM element to mount the &lt;application&gt; into.
 * @returns {object} the language object.
 */
export function createLanguage({ source, mount }) {
  return {
    // Raw inputs - features may rewrite `source` (e.g. when imports inline
    // additional XML) before it is finally parsed.
    source,
    mount,
    // Resolved DOM document and root after `parseSource()` runs.
    document: null,
    root: null,
    // Names of applied features, useful for debugging / introspection.
    features: [],
    // Custom components keyed by their tag name (e.g. "xes-feature-badge").
    components: new Map(),
    // Behaviors keyed by short name (e.g. "copy", "drag", "drop").
    behaviors: new Map(),
    // Tests collected during feature install. Run on `start()` for sanity.
    tests: [],

    /**
     * Apply a feature plugin.
     *
     * A feature is a function that receives the language object and adds
     * methods/state onto it. We intentionally do not use classes here -
     * mutation by feature keeps the surface area readable for new readers.
     */
    use(feature) {
      this.features.push(feature.name || 'anonymousFeature');
      feature(this);
      return this;
    },

    /**
     * Register a self-test. Tests are run during `start()` so a broken
     * feature fails loudly rather than silently corrupting later runs.
     */
    test(name, fn) {
      this.tests.push({ name, fn });
    },

    /**
     * Execute all collected tests. Failed tests print to console.error but
     * do NOT throw - rendering should still proceed so users can see any
     * UI even when a self-test regressed.
     */
    runTests() {
      const rows = [];
      for (const t of this.tests) {
        try {
          t.fn();
          rows.push({ test: t.name, ok: true });
        } catch (error) {
          rows.push({ test: t.name, ok: false });
          console.error(`[galath test failed] ${t.name}`, error);
        }
      }
      // console.table is a friendly summary in dev tools; no-op in stripped
      // production builds.
      if (typeof console.table === 'function') console.table(rows);
    },

    /**
     * Run the language: parse, resolve imports, register components, run
     * tests, mount the application. This is async because import resolution
     * may fetch additional XML files over the network.
     *
     * Order matters:
     *   1. parseSource     - the entry document becomes a DOM tree.
     *   2. resolveImports  - <import src="..."> nodes are replaced by the
     *                        children of the fetched documents (recursive,
     *                        deduped by absolute URL).
     *   3. registerComponents - now all <component> elements are present.
     *   4. runTests / mountApplication - sanity + render.
     */
    async start() {
      this.parseSource();
      if (typeof this.resolveImports === 'function') await this.resolveImports();
      this.registerComponents();
      this.runTests();
      this.mountApplication();
      return this;
    },
  };
}

/**
 * The CORE feature: XML parsing + tiny utilities every other feature needs.
 *
 * Other features can rely on:
 *
 *   - `language.parseSource()` populates `language.document` / `language.root`.
 *   - `language.childElements(parent, name?)` returns element children.
 *   - `language.firstChildElement(parent, name)` is a shortcut.
 *   - `language.serialize(node)` emits XML text.
 *   - `language.uid()` generates a short, monotonic-ish unique id.
 */
export function coreFeature(language) {
  language.parseSource = () => {
    // DOMParser is the platform's XML parser. It returns a Document with a
    // <parsererror> element when input is malformed; we surface the error
    // text so users see exactly what went wrong, with line/column info.
    const parser = new DOMParser();
    const doc = parser.parseFromString(language.source, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(err.textContent.trim());
    language.document = doc;
    language.root = doc.documentElement;
  };

  /**
   * Like `parent.children` but optionally filtered by local or qualified tag
   * name. This handles both `<gal:component>` lookups by local name and
   * lifecycle hooks like `<on:mount>` that are addressed by qualified name.
   */
  language.childElements = (parent, name = null) =>
    [...parent.children].filter(
      el => !name || el.localName === name || el.nodeName === name,
    );

  /** Convenience: first child matching `name`, or null. */
  language.firstChildElement = (parent, name) =>
    language.childElements(parent, name)[0] ?? null;

  /** Re-serialize a parsed XML node back to a string (for echo/debug views). */
  language.serialize = node => new XMLSerializer().serializeToString(node);

  /**
   * Short, unique, mostly-monotonic id. Used as a default for newly inserted
   * nodes so XPath predicates like `[@id=...]` work without manual ids.
   */
  language.uid = () =>
    `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // -- self-tests -------------------------------------------------------------
  language.test('core: source parses as well-formed XML', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(language.source, 'application/xml');
    assert(!doc.querySelector('parsererror'), 'source is not well-formed XML');
  });

  language.test('core: childElements matches qualified namespaced tags', () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      '<root xmlns:on="urn:galath:on"><on:mount /></root>',
      'application/xml',
    );
    assert(
      language.childElements(doc.documentElement, 'on:mount').length === 1,
      'qualified namespaced element was not matched',
    );
  });
}

/**
 * Tiny assertion helper. Re-exported so feature tests don't have to ship
 * their own. We don't import a test framework - keeping galath
 * dependency-free is part of the design.
 */
export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}
