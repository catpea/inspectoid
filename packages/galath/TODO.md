# Galath - TODO

Items left for follow-up. None are blocking; the runtime, the playground, and
the reference demo all work as shipped. These are improvements that would make
Galath more capable, more polished, or more productive for authors.

The list is grouped by who can pick it up. The "Sonnet-friendly" pile is
deliberately scoped: clear inputs, clear outputs, low ambiguity.

---

## Sonnet-friendly (good first tasks)

### Documentation

- [ ] **Write `packages/galath/README.md`.** Cover: install (none), import
  map setup, two-line boot, link to playground, link to seed.html, list of
  features. Keep under 300 lines.
- [ ] **Write `docs/PATHS.md`** documenting the path grammar. Include a
  cheat-sheet for `/foo/bar`, `/foo/bar[@id=x]`, `$todo/@text`, `/text()`,
  wildcard `*`. Show what's unsupported (descendant `//`, function calls
  beyond `text()`, multi-step predicates).
- [ ] **Write `docs/EXPRESSIONS.md`** documenting which helpers are in
  scope (`uid`, `select`, `valueOf`, `set`, `attr`, `deleteNode`,
  `setNode`, `$event`, all signal names, all locals). Note the JS escape
  hatch for anything else.

### Playground polish

- [ ] **Add a "Run" button** to each chapter's source listing that opens
  the snippet in a new tab as a complete HTML file. Implementation: a
  command that copies the snippet into a Blob and `URL.createObjectURL`,
  with the standard import map / boot wrapper.
- [ ] **Add basic syntax highlighting** to `<pre class="xes-code">`
  blocks. Either ship a tiny tokenizer in `playground/components/` or
  add a `use:highlight` behavior. Keep it under 150 lines; we don't
  want a full Prism dependency.
- [ ] **Add a toggle** to switch between the "narrated" chapter view
  (current) and a "code-only" view that hides the docs card. Useful for
  experienced readers.
- [ ] **Keyboard navigation**: left/right arrows move between chapters.
  Implement as a `keydown` listener in the playground's `<on:mount>`.

### Chapter improvements

- [ ] **02-signals**: add a "computed chain" demo - `a -> b -> c` where
  each is computed from the previous. Explain dependency tracking is
  explicit (via `from=`).
- [ ] **04-bindings**: add `bind:` examples for `<select>` and date
  inputs.
- [ ] **05-lists**: add an `index`-based example using the implicit
  `index` local that `<repeat>` provides.
- [ ] **06-commands**: add a `<command shortcut="ctrl+s">` example. (See
  language work below - shortcuts are not yet implemented.)
- [ ] **09-behaviors**: write a "build your own behavior" subsection
  showing how to register a new behavior via
  `language.behaviors.set(...)` from a feature plugin.

### Tests

- [ ] **Add a Playwright smoke test** that boots `index.html`, clicks
  through each chapter, and asserts there's no console error.
- [ ] **Add unit tests for path parsing** in `packages/galath/test/`
  covering the cases listed in `docs/PATHS.md`.
- [ ] **Add unit tests for `morph.js`** covering: focus preservation,
  child swap by tag, attribute removal, custom-element child skip.

---

## Larger pieces (Opus-y, but not urgent)

### Language features

- [x] **`<slot>` support** so components can accept inline children. This
  removes the "pass code in a signal name" workaround in `code-card`.
  Touches `component.js` (capture inline children before stamping
  xesRoot) and `rendering.js` (resolve `<slot>` against the captured
  fragment, fall back to default content).
- [x] **Cross-component scope reads.** Add a directive like
  `bind:from-parent="signalName"` that lets a child read a signal in its
  parent component. Walk up via `closest('[data-xes-root]')`.
- [x] **Keyed `<repeat>` / `<items>`**. Today the renderer relies on
  positional matching plus `morph.js`. With reorders this is fine but
  slower than necessary. Add `key="@id"` and a simple keyed reconciler.
- [x] **`<switch on="expr"><case value="...">...</case><default>...</default></switch>`**.
  Cleaner than chained `<if>`. Lower in `rendering.js`.
- [x] **Async operations**: `<fetch url="..." into="signal">` and
  `<command async>`. Useful for real-world data loading without dropping
  into `<eval>`.
- [x] **Form validation**: re-introduce XForms `<bind constraint="..."
  required="..." type="...">` and surface validation state to inputs.

### Tooling

- [ ] **VS Code extension** for `.xml` syntax in the Galath dialect
  (color the directives, autocomplete bindings, hover docs).
- [ ] **A static linter** that walks Galath sources and reports common
  mistakes: unknown component tags, dead `<command name>` (never
  referenced), unbound `bind:` paths against the declared instance tree.
- [ ] **Source map** from rendered HTML elements back to the source
  XML line. Useful for in-browser DevTools-like inspection.

### Performance

- [x] **Granular signal -> render mapping**. Today any signal change
  re-renders the whole component view. Track which bindings depend on
  which signals (we already collect bindings during render); re-run only
  the affected expressions on update.
  
### Ecosystem

- [ ] **A few real apps** built on Galath - a markdown editor, a kanban
  board, a small SPA that talks to an HTTP API. They will surface holes
  in the language we don't see from the playground.
- [ ] **Standard component library** in `packages/galath-ui/` -
  consistent buttons, modal, table, form. Optional; depends only on the
  base runtime.

---

## Open questions

- Should component instances persist across `<if>` toggles, or always
  re-mount? Today they re-mount. Persisting would need a "keep alive"
  directive and a place to stash detached instances.
  answer: follow the web-component approach, remount
- Should `<text value="...">` accept template syntax like `{count}` or
  always be a single path? Right now it's a single path; mixing would
  collide with the path grammar.
  answer: no collisions, keep it simple.
- What do we do about CSS-in-Galath? Today `<style>` is a global
  scoped sheet. Should we accept `<style scoped="false">` or
  `<style :where>` for opt-in scope rules?
  answer: CSS must be external to Galath, provided by a powerful build system like CSS.
  
## Not Interested / Cancelled

- [-] **Compile views**. Pre-compile `<view>` to a JS function at
  registerComponent time so renders skip the XML walk. Big change; only
  worth it if profiling shows the renderer is a bottleneck.
