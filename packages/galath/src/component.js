// =============================================================================
// component.js
//
// Compiles `<component name="..." tag="...">` definitions into Custom
// Elements. Each Galath component becomes a real `<custom-tag>` you can
// drop into HTML or other Galath views.
//
// What lives inside a `<component>`:
//
//   <model>            - signals, computed signals, and the instance tree
//     <signal name="x" value="..." />
//     <computed name="y" from="x">expr</computed>     (or <map> - same)
//     <instance>...your XML data...</instance>
//   </model>
//
//   <commandset>       - addressable commands (button command="add")
//   <controller>       - named actions (#actionName)
//   <listeners>        - data-tree event listeners
//   <datatemplate>     - reusable view fragments
//   <style>            - scoped CSS (auto-prefixed by component tag)
//   <on:mount>         - operations to run after the element is connected
//   <on:unmount>       - operations to run before the element is removed
//   <view>             - the renderable subtree
//
// Reactivity is whole-component: when ANY signal in the component scope (or
// the instance-tree version counter) changes, the renderer is queued for
// the next microtask. The renderer rebuilds the view, then `morph.js`
// surgically updates the live DOM. Inputs in focus keep their value /
// selection (see morph.js for the gory details).
// =============================================================================

import { morph } from './morph.js';

export function componentFeature(language) {
  // ---------------------------------------------------------------------------
  // Track which component scoped-style sheets we've already injected so
  // multiple instances of the same component don't keep re-adding rules.
  // Keyed by tag name.
  // ---------------------------------------------------------------------------
  const installedStyles = new Set();

  /**
   * Register every `<component>` in the parsed document as a Custom Element.
   * Idempotent for already-registered tags (a re-`start()` will not throw).
   */
  language.registerComponents = () => {
    for (const definition of language.childElements(language.root, 'component')) {
      registerComponent(definition);
    }
  };

  function registerComponent(definition) {
    const name = definition.getAttribute('name');
    const tag = definition.getAttribute('tag') || `xes-${name}`;
    const defaults = componentDefaults(definition);
    language.components.set(tag, { name, tag, definition, defaults });

    // Inject scoped <style> contents into the document head once per tag.
    installComponentStyles(tag, definition);

    // `customElements.define` throws when called twice for the same name.
    // Skip silently in that case so feature.use().start() can be re-run in
    // dev playgrounds without nuking the page.
    if (customElements.get(tag)) return;

    customElements.define(
      tag,
      class extends HTMLElement {
        // The runtime feeds attributes into signals automatically. We tell
        // the platform which ones to observe via the defaults map.
        static get observedAttributes() {
          return Object.keys(defaults);
        }

        constructor() {
          super();
          // Stable references - never replaced on re-render.
          this.definition = definition;
          this.defaults = defaults;
          this.scope = null;          // top-level Concern, lives until disconnect.
          this.renderScope = null;    // child scope reset on every render.
          this.tree = null;           // XTree (if the component declared an instance).
          this.xesRoot = null;        // private mount point inside `this`.
          this.renderQueued = false;
          this.commands = new Map();
          this.actions = new Map();
          this.templates = new Map();
        }

        connectedCallback() {
          if (this.scope) return; // already connected; ignore reparenting.
          this.scope = new language.Concern(tag);

          // Children authored between <my-tag>...</my-tag> are *slot*
          // content. Capture them before inserting our own root so a
          // <slot> in the view can place them. We move - not clone - so
          // any listeners the parent attached survive.
          if (!this.slotNodes) {
            this.slotNodes = [...this.childNodes];
            for (const node of this.slotNodes) super.removeChild(node);
          }

          this.xesRoot = document.createElement('div');
          this.xesRoot.setAttribute('data-xes-root', tag);
          super.appendChild(this.xesRoot);

          this.setupAttributes();
          this.setupModel();
          this.setupCrossScopeBinds();
          language.setupTemplates(this);
          language.setupCommands(this);
          language.setupController(this);
          language.setupListeners(this);
          this.subscribeForRender();
          this.renderNow();
          this.runLifecycle('on:mount');
        }

        disconnectedCallback() {
          this.runLifecycle('on:unmount');
          this.renderScope?.dispose();
          this.scope?.dispose();
          this.renderScope = null;
          this.scope = null;
        }

        attributeChangedCallback(name, oldValue, newValue) {
          if (!this.scope || Object.is(oldValue, newValue)) return;
          const sig = this.scope.signal(name);
          if (sig) sig.value = language.coerce(newValue ?? this.defaults[name] ?? '');
        }

        // -- setup phases ------------------------------------------------------

        // Map every "default" attribute to a signal of the same name. This
        // is the entry point for component props - parents pass them as
        // attributes, the component reads them as `{name}` in the view.
        setupAttributes() {
          for (const [name, value] of Object.entries(this.defaults)) {
            this.scope.signal(
              name,
              new language.Signal(
                language.coerce(this.hasAttribute(name) ? this.getAttribute(name) : value),
              ),
            );
          }
        }

        // <model>: signals, computed, and the instance tree. We accept the
        // <model> wrapper, but if missing, we look for signals/instance
        // directly under <component> too (for terse single-purpose
        // components in the docs).
        setupModel() {
          const model = language.firstChildElement(this.definition, 'model') ?? this.definition;

          // <signal name="x" value="..." />  - or text content if `value`
          // attribute absent. CDATA-wrapped strings are common in docs.
          for (const signalEl of language.childElements(model, 'signal')) {
            const sigName = signalEl.getAttribute('name');
            const raw = signalEl.hasAttribute('value')
              ? signalEl.getAttribute('value')
              : signalEl.textContent.trim();
            this.scope.signal(sigName, new language.Signal(language.coerce(raw)));
          }

          // <instance>...</instance>  -> XTree of XNodes.
          const instanceEl =
            language.firstChildElement(model, 'instance') ??
            language.firstChildElement(model, 'data');
          if (instanceEl) {
            const root = new language.XNode('data');
            this.tree = new language.XTree(root);
            for (const child of [...instanceEl.children]) {
              root.append(language.parseDataElement(child), { silent: true });
            }
          }

          // <bind ref="/path" required="true" constraint="value > 0"
          //       type="email|number|date" /> - XForms-style validation
          // declarations. Stored on the instance so the `valid()` /
          // `invalid()` / `required()` expression helpers can read them.
          this.binds = [];
          for (const bindEl of language.childElements(model, 'bind')) {
            const ref = bindEl.getAttribute('ref');
            if (!ref) continue;
            this.binds.push({
              ref,
              required: bindEl.getAttribute('required'),
              constraint: bindEl.getAttribute('constraint'),
              type: bindEl.getAttribute('type'),
            });
          }

          // <computed name="x" from="y">expr</computed> - derived signal.
          // The legacy <map> spelling still works.
          for (const tagName of ['computed', 'map']) {
            for (const el of language.childElements(model, tagName)) {
              const sourceName = el.getAttribute('from');
              const source = this.scope.signal(sourceName) || this.tree?.version;
              if (!source) continue;
              const expr = (el.querySelector('expression')?.textContent || el.textContent || 'value').trim();
              this.scope.map(el.getAttribute('name'), source, value =>
                language.evaluate(expr, this, { value, [sourceName]: value }, value),
              );
            }
          }
        }

        // Read `bind:from-parent="signalName"` (and the alias `from-parent`)
        // attributes from the host element. For each, find the nearest
        // ancestor Galath component, look up the named signal there, and
        // mirror it into a same-named signal on this component. Edits to
        // the parent signal flow down automatically; we don't push back
        // to the parent (read-only by design - keeps the dataflow clear).
        setupCrossScopeBinds() {
          const specs = [];
          for (const attr of [...this.attributes]) {
            if (attr.name === 'bind:from-parent' || attr.name === 'from-parent') {
              specs.push(attr.value);
            }
          }
          if (specs.length === 0) return;
          const parentInstance = language.findParentComponent(this);
          if (!parentInstance) return;
          for (const name of specs) {
            const parentSig = parentInstance.scope?.signal(name);
            if (!parentSig) continue;
            const local = new language.Signal(parentSig.value);
            this.scope.signal(name, local);
            this.scope.collect(parentSig.subscribe(v => { local.value = v; }, false));
          }
        }

        // Wire signals -> render. Tree mutations always queue a render
        // (selects/predicates can depend on any node), but per-signal
        // subscriptions are now installed by `renderNow()` based on which
        // signals the last render *actually read*. Unrelated signal
        // changes no longer trigger work.
        subscribeForRender() {
          if (this.tree) {
            this.scope.collect(
              this.tree.version.subscribe(() => this.scheduleRender(), false),
            );
          }
        }

        scheduleRender() {
          if (this.renderQueued) return;
          this.renderQueued = true;
          queueMicrotask(() => {
            this.renderQueued = false;
            if (this.isConnected) this.renderNow();
          });
        }

        renderNow() {
          if (!this.xesRoot) return;
          // Tear down everything attached to the previous render: bindings,
          // behaviors, listeners, AND the signal subscriptions we set up
          // at the end of the last render. Then open a fresh render scope.
          this.renderScope?.dispose();
          this.renderScope = this.scope.scope('render');

          // Reset the read-tracking set; the proxy in buildContext records
          // every signal name actually accessed during this render.
          this.readSignals = new Set();

          const view = language.firstChildElement(this.definition, 'view');
          const bindings = [];
          const html = view
            ? language.renderChildren([...view.childNodes], this, {}, bindings)
            : '';

          // Build an off-screen template root, then morph the live root to
          // match it. Morph preserves focus/value of inputs that are
          // currently in focus.
          const nextRoot = document.createElement('div');
          nextRoot.setAttribute(
            'data-xes-root',
            this.definition.getAttribute('tag') || this.definition.getAttribute('name'),
          );
          nextRoot.innerHTML = html;
          morph(this.xesRoot, nextRoot);

          // After the DOM is in place, attach listeners and behaviors to
          // the live elements based on the binding records the renderer
          // emitted alongside the HTML.
          language.installBindings(this, bindings);

          // Subscribe only to the signals this render actually read. The
          // subscriptions live on `renderScope`, so the next render
          // disposes them automatically.
          const schedule = () => this.scheduleRender();
          for (const name of this.readSignals) {
            const sig = this.scope.signal(name);
            if (sig) this.renderScope.collect(sig.subscribe(schedule, false));
          }
        }

        // Run <on:mount> / <on:unmount> ops, if defined.
        runLifecycle(hookName) {
          const hook = language.firstChildElement(this.definition, hookName);
          if (!hook) return;
          language.runOperations([...hook.children], this, {}, null);
        }
      },
    );
  }

  /**
   * Read the component definition's "prop default" attributes. We exclude
   * reserved names (`name`, `tag`) and namespaced attributes (which are
   * framework directives, not props).
   */
  function componentDefaults(definition) {
    const reserved = new Set(['name', 'tag']);
    const out = {};
    for (const attr of [...definition.attributes]) {
      if (!reserved.has(attr.name) && !attr.name.includes(':')) {
        out[attr.name] = attr.value;
      }
    }
    return out;
  }

  /**
   * Pull `<style>` blocks out of the component definition and inject them
   * into the document head, prefixed so each rule only matches inside this
   * component's own root. We use the `data-xes-root` attribute the runtime
   * stamps on every component root. This is "scoped CSS, lite" - simple,
   * predictable, and a 5-line implementation.
   */
  function installComponentStyles(tag, definition) {
    if (installedStyles.has(tag)) return;
    const blocks = [...definition.children].filter(c => c.localName === 'style');
    if (blocks.length === 0) {
      installedStyles.add(tag);
      return;
    }
    const scope = `[data-xes-root="${tag}"]`;
    const css = blocks.map(b => prefixCss(b.textContent, scope)).join('\n');
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-xes-style-for', tag);
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    installedStyles.add(tag);
  }

  /**
   * Prepend `prefix ` to every selector so the CSS only matches inside
   * the component root. We rely on splitting at top-level commas - this is
   * not a full CSS parser, but covers nearly everything sane authors write.
   *
   *   .card .body { ... }            ->  [data-xes-root="..."] .card .body { ... }
   *   .a, .b > p { ... }             ->  [data-xes-root="..."] .a, [data-xes-root="..."] .b > p { ... }
   *   :host(.dark) .x                ->  [data-xes-root="..."].dark .x   (sugar)
   */
  function prefixCss(css, prefix) {
    // Walk the source and split on top-level rule blocks.
    let out = '';
    let i = 0;
    while (i < css.length) {
      const braceAt = css.indexOf('{', i);
      if (braceAt < 0) {
        out += css.slice(i);
        break;
      }
      const selectorBlock = css.slice(i, braceAt);
      const ruleEnd = matchingBrace(css, braceAt);
      const ruleBody = css.slice(braceAt, ruleEnd + 1);

      // @-rules: pass through unchanged. (Authoring `@media` inside a
      // scoped style still works because its child rules will be scoped
      // when CSSOM evaluates them; we keep the @ wrapper as-is.)
      if (selectorBlock.trim().startsWith('@')) {
        out += selectorBlock + ruleBody;
        i = ruleEnd + 1;
        continue;
      }

      const scoped = selectorBlock
        .split(',')
        .map(sel => {
          const trimmed = sel.trim();
          if (!trimmed) return trimmed;
          // `:host` is a Web Components convention. We treat `:host` as
          // "the component root itself" and `:host(.x)` as a class on it.
          if (trimmed.startsWith(':host')) {
            return trimmed.replace(/^:host(\([^)]*\))?/, (_, mod) =>
              mod ? `${prefix}${mod}` : prefix,
            );
          }
          return `${prefix} ${trimmed}`;
        })
        .join(', ');

      out += scoped + ruleBody;
      i = ruleEnd + 1;
    }
    return out;
  }

  function matchingBrace(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) return i;
    }
    return text.length - 1;
  }

  /**
   * Run every `<bind>` declaration that targets `path` against the current
   * value at that path and return a summary `{value, required, type,
   * constraint, valid}`. Used by the `valid()` / `invalid()` /
   * `required()` / `validity()` expression helpers.
   *
   * Type validators are intentionally minimal - just enough that authors
   * can wire up Bootstrap is-invalid styling without dropping into JS.
   */
  language.checkValidity = (instance, path, local = {}) => {
    const summary = { value: '', required: false, type: true, constraint: true, valid: true };
    if (!instance.binds) return summary;
    const value = instance.tree?.valueOf(path, local) ?? '';
    summary.value = value;
    for (const bind of instance.binds) {
      if (bind.ref !== path) continue;
      if (bind.required) {
        const isRequired = bind.required === 'true' || bind.required === true ||
          Boolean(language.evaluate(bind.required, instance, local, false));
        if (isRequired) {
          summary.required = true;
          if (value === '' || value == null) summary.valid = false;
        }
      }
      if (bind.type && !checkType(bind.type, value)) {
        summary.type = false;
        summary.valid = false;
      }
      if (bind.constraint) {
        const ok = Boolean(
          language.evaluate(bind.constraint, instance, { ...local, value }, false),
        );
        if (!ok) {
          summary.constraint = false;
          summary.valid = false;
        }
      }
    }
    return summary;
  };

  function checkType(type, value) {
    if (value === '' || value == null) return true; // empty handled by `required`
    switch (String(type).toLowerCase()) {
      case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      case 'number': return !Number.isNaN(Number(value));
      case 'integer': return /^-?\d+$/.test(String(value));
      case 'url': try { new URL(String(value)); return true; } catch { return false; }
      case 'date': return !Number.isNaN(Date.parse(String(value)));
      default: return true;
    }
  }

  /**
   * Walk up from `el` looking for the nearest ancestor Custom Element that
   * is one of our registered Galath components. Returns the element (which
   * is its own instance) or null.
   */
  language.findParentComponent = el => {
    let cur = el?.parentNode;
    while (cur) {
      // Crossing shadow boundaries is unusual in Galath but harmless.
      if (cur.host) cur = cur.host;
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const tag = cur.localName;
        if (tag.includes('-') && language.components.has(tag)) return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  };

  /**
   * Read `name` from the nearest enclosing Galath component scope. Used by
   * the `parentSignal(name)` expression helper.
   */
  language.parentSignal = (instance, name) => {
    const parent = language.findParentComponent(instance);
    return parent?.scope?.signal(name)?.value ?? '';
  };

  /**
   * Mount the application. Every top-level `<application>` child becomes
   * HTML inside `language.mount`. Custom-element tags resolve through the
   * components we just registered.
   */
  language.mountApplication = () => {
    const application = language.firstChildElement(language.root, 'application');
    if (!application) throw new Error('No <application> found in source.');
    language.mount.innerHTML = [...application.childNodes]
      .map(node => (node.nodeType === Node.TEXT_NODE ? '' : language.serialize(node)))
      .join('\n');
  };
}
