// =============================================================================
// instance-model.js
//
// XForms-style data model. State is an XML *instance tree* of `XNode`s.
// Every attribute and text node is itself a `Signal`, so views can bind
// directly to paths and react to mutations.
//
// Public surface:
//
//   XNode    - one element node with its own attribute signals.
//   XTree    - the tree wrapper; emits routed events on every mutation.
//   coerce   - string -> primitive coercion shared with bindings.
//   parseDataElement - parse an XML element into an XNode, recursively.
//
// Path syntax (a strict subset of XPath - intentional):
//
//   /todos/todo                       child step
//   /todos/todo[@done=true]           attribute predicate (equality)
//   /todos/todo[@text=hello]          unquoted predicate value
//   /todos/todo[2]                    1-based index predicate
//   $todo                             local variable bound by repeat/items
//   $todo/@text                       attribute on a local variable
//
// We only implement what views need; full XPath is deliberately out of scope.
// If you find yourself wanting predicates with `or`, multi-step descendants,
// or function calls, please reach for a `<computed>` instead - that's the
// pressure valve.
// =============================================================================

import { assert } from './core.js';

export function instanceModelFeature(language) {
  const { Signal, Disposable } = language;

  // ---------------------------------------------------------------------------
  // XNode - reactive XML element node
  // ---------------------------------------------------------------------------
  class XNode {
    constructor(name, attrs = {}, text = '') {
      this.name = name;
      this.parent = null;
      this.children = [];
      this.tree = null; // back-pointer to the owning XTree, set on insert.
      this.text = new Signal(text); // own text content (not children's).
      this.attributes = new Map();
      for (const [k, v] of Object.entries(attrs)) {
        this.attributes.set(k, new Signal(coerce(v)));
      }
    }

    /**
     * Get the signal for an attribute, creating an empty one if it doesn't
     * exist. Lazy creation matters: a binding can subscribe to `@foo` before
     * any code has set it, and we want the first set to fire that
     * subscriber.
     */
    attr(name) {
      if (!this.attributes.has(name)) this.attributes.set(name, new Signal(''));
      return this.attributes.get(name);
    }

    get(name) {
      return this.attr(name).value;
    }

    set(name, value) {
      const sig = this.attr(name);
      const oldValue = sig.value;
      sig.value = coerce(value);
      if (!Object.is(oldValue, sig.value)) {
        this.tree?.notify({
          type: 'xforms-value-changed',
          node: this,
          attribute: name,
          oldValue,
          value: sig.value,
        });
      }
    }

    /** Append a child. Pass `silent: true` during initial parse to skip events. */
    append(child, { silent = false } = {}) {
      child.parent = this;
      this.children.push(child);
      child.adoptTree(this.tree);
      if (!silent) {
        this.tree?.notify({ type: 'xforms-insert', node: child, parent: this });
      }
      return child;
    }

    insertBefore(child, reference, { silent = false } = {}) {
      child.parent = this;
      child.adoptTree(this.tree);
      const i = this.children.indexOf(reference);
      if (i < 0) this.children.push(child);
      else this.children.splice(i, 0, child);
      if (!silent) {
        this.tree?.notify({ type: 'xforms-insert', node: child, parent: this });
      }
      return child;
    }

    remove() {
      if (!this.parent) return;
      const parent = this.parent;
      parent.children = parent.children.filter(c => c !== this);
      this.parent = null;
      parent.tree?.notify({ type: 'xforms-delete', node: this, parent });
    }

    /** Recursively claim a tree pointer for this subtree (after splicing). */
    adoptTree(tree) {
      this.tree = tree;
      for (const c of this.children) c.adoptTree(tree);
    }

    /** Slash-separated path from the root, e.g. "/todos/todo". */
    path() {
      const parts = [];
      let n = this;
      while (n && n.parent) {
        parts.unshift(n.name);
        n = n.parent;
      }
      return '/' + parts.join('/');
    }
  }

  // ---------------------------------------------------------------------------
  // XTree - owner of the root XNode plus listener bus
  // ---------------------------------------------------------------------------
  class XTree {
    constructor(root) {
      this.root = root;
      // Monotonic version counter. The renderer subscribes to this so any
      // mutation in the tree triggers a re-render.
      this.version = new Signal(0);
      // Routed listeners by event type. Use '*' to listen to everything.
      this.listeners = new Map();
      root.adoptTree(this);
    }

    on(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
      return new Disposable(() => this.listeners.get(type)?.delete(fn));
    }

    /**
     * Dispatch an event to subscribers. Always increments `version` so the
     * renderer wakes up. Event objects are augmented with a `path` so XML
     * `<listener observer="/some/path">` can filter by prefix.
     */
    notify(event) {
      event.path = event.node?.path?.() || event.parent?.path?.() || '/';
      this.version.value = this.version.value + 1;
      for (const fn of [...(this.listeners.get(event.type) ?? [])]) fn(event);
      for (const fn of [...(this.listeners.get('*') ?? [])]) fn(event);
    }

    /** Resolve a path to a list of XNodes. Returns [] when no match. */
    select(path, context = {}) {
      if (!path) return [];
      path = String(path).trim();
      // `/foo/@attr` and `/foo/text()` are *value* selectors; treated here as
      // "node containing the value" so callers can post-process.
      if (path.includes('/@')) path = path.slice(0, path.lastIndexOf('/@'));
      if (path.endsWith('/text()')) path = path.slice(0, -7);

      // Local variable form: $name or $name/...
      if (path.startsWith('$')) {
        const m = path.match(/^\$([A-Za-z_][\w-]*)(?:\/(.*))?$/);
        if (!m) return [];
        const base = context[`$${m[1]}`] ?? context[m[1]];
        if (!base) return [];
        const rest = m[2];
        return rest ? selectFrom(base, splitPath(rest)) : [base];
      }

      // Absolute form: /foo/bar
      return selectFrom(this.root, splitPath(path.replace(/^\//, '')));
    }

    /** Resolve a path or `path/@attr` or `path/text()` to a value. */
    valueOf(path, context = {}) {
      const a = String(path).match(/^(.*)\/@([\w:-]+)$/);
      if (a) return this.select(a[1], context)[0]?.get(a[2]) ?? '';
      const t = String(path).match(/^(.*)\/text\(\)$/);
      if (t) return this.select(t[1], context)[0]?.text.value ?? '';
      const node = this.select(path, context)[0];
      return node?.text.value ?? node ?? '';
    }

    /** Write a value to `path/@attr` or `path/text()`. */
    setValue(path, value, context = {}) {
      const a = String(path).match(/^(.*)\/@([\w:-]+)$/);
      if (a) {
        for (const node of this.select(a[1], context)) node.set(a[2], value);
        return;
      }
      const t = String(path).match(/^(.*)\/text\(\)$/);
      if (t) {
        for (const node of this.select(t[1], context)) {
          const old = node.text.value;
          node.text.value = coerce(value);
          if (!Object.is(old, node.text.value)) {
            this.notify({
              type: 'xforms-value-changed',
              node,
              oldValue: old,
              value: node.text.value,
            });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Path internals
  // ---------------------------------------------------------------------------

  // Split a path into steps but tolerate predicate brackets that may
  // contain slashes in the value. Today we don't allow slashes in values, so
  // the simple split is fine; this helper keeps the call site readable.
  function splitPath(pathBody) {
    return pathBody.split('/').filter(Boolean);
  }

  // Recursive walk: from `node`, take the step in `parts[0]` and recurse on
  // the rest. `*` matches any element name.
  function selectFrom(node, parts) {
    if (parts.length === 0) return [node];
    const [raw, ...tail] = parts;
    const step = parseStep(raw);
    if (!step) return [];
    let matches = node.children.filter(c => step.name === '*' || c.name === step.name);
    if (step.attr) {
      matches = matches.filter(c => looseEqual(c.get(step.attr), step.value));
    }
    if (step.index != null) {
      matches = matches[step.index - 1] ? [matches[step.index - 1]] : [];
    }
    return matches.flatMap(c => selectFrom(c, tail));
  }

  // Parse one step: `name`, `name[@attr=value]`, `name[2]`.
  function parseStep(step) {
    const m = step.match(
      /^([\w:-]+|\*)(?:\[@([\w:-]+)=['"]?([^'"\]]+)['"]?\])?(?:\[(\d+)\])?$/,
    );
    if (!m) return null;
    return {
      name: m[1],
      attr: m[2],
      value: coerce(m[3]),
      index: m[4] ? Number(m[4]) : null,
    };
  }

  // Equality is "loose" (string comparison) because XML attributes start as
  // strings; we coerce on the right side, so for a predicate like
  // `[@done=true]` against `done="true"` the comparison succeeds.
  function looseEqual(a, b) {
    return String(a) === String(b);
  }

  /**
   * Coerce a string into a primitive: "true"/"false" -> Boolean,
   * "12.5" -> Number, "" -> empty string. Used everywhere a value enters
   * the tree from text.
   */
  function coerce(value) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      /^-?\d+(\.\d+)?$/.test(value)
    ) {
      return Number(value);
    }
    return value ?? '';
  }

  // Read element attributes into a plain object, optionally interpolating
  // `{expr}` placeholders. Skips namespaced attrs (those with `:`) because
  // those carry framework directives like `bind:` / `on:`.
  function attrsObject(element, instance = null, local = {}) {
    const out = {};
    for (const attr of [...element.attributes]) {
      if (attr.name.includes(':')) continue;
      out[attr.name] = instance
        ? language.interpolate(attr.value, instance, local, { raw: true })
        : attr.value;
    }
    return out;
  }

  /**
   * Recursively turn an XML element tree (as produced by DOMParser) into an
   * XNode tree. `silent: true` skips events while the tree is still empty.
   */
  function parseDataElement(element, instance = null, local = {}) {
    const node = new XNode(
      element.localName,
      attrsObject(element, instance, local),
      ownText(element),
    );
    for (const child of [...element.children]) {
      node.append(parseDataElement(child, instance, local), { silent: true });
    }
    return node;
  }

  // Direct text children only - we don't merge descendant text.
  function ownText(element) {
    return [...element.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent)
      .join('')
      .trim();
  }

  // Expose to other features.
  language.XNode = XNode;
  language.XTree = XTree;
  language.coerce = coerce;
  language.parseDataElement = parseDataElement;

  // ---------------------------------------------------------------------------
  // Self-tests
  // ---------------------------------------------------------------------------
  language.test('instance: path selection, predicate, valueOf', () => {
    const root = new XNode('data');
    const tree = new XTree(root);
    root.append(new XNode('todo', { id: 'a', done: 'true' }), { silent: true });
    root.append(new XNode('todo', { id: 'b', done: 'false' }), { silent: true });
    assert(tree.select('/todo[@done=true]').length === 1, 'predicate failed');
    assert(tree.valueOf('/todo[@id=b]/@done') === false, 'valueOf failed');
  });
}
