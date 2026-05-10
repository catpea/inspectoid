# GALATH-SKILL — Using Galath with Pre-built CSS Components

A field guide for AI agents working in projects that combine **galath** (the XML
reactive framework) with a **pre-built Bootstrap CSS kit** like bogan-css.

---

## What You Are Working With

### galath
An XML language for web applications. No bundler, no transpiler. The runtime is
loaded via an import map. All application logic lives inside a
`<script type="application/xml">` tag that the browser ignores; galath's
`boot()` function reads it as text and parses it with `DOMParser`.

### bogan-css
A Bootstrap 5 UI kit for Storybook-style component workshop interfaces. Provides
the `cf-*` class system for the three-column shell (sidebar / canvas / docs),
toolbar, addon panel, and story tree. Ships with Bootstrap JS and a thin
`components.js` for toggling behaviour (search, theme, fullscreen).

---

## The Boot Pattern

Every bogan page follows this exact skeleton:

```html
<!-- 1. CSS — include bogan-css compiled sheet (has Bootstrap + bi-* icons built in) -->
<link rel="stylesheet" href="./node_modules/bogan-css/product/css/components-fantasyui.min.css">

<!-- 2. Import map — point bare specifiers at galath's local source -->
<script type="importmap">
  {
    "imports": {
      "galath":      "./node_modules/galath/packages/galath/src/index.js",
      "galath/boot": "./node_modules/galath/packages/galath/src/boot.js"
    }
  }
</script>

<!-- 3. Mount point — galath renders here -->
<div id="mount"></div>

<!-- 4. Galath XML source — browser ignores this MIME type -->
<script type="application/xml" id="galath-source">
  <galath version="1.0"
          xmlns:bind="urn:galath:bind"
          xmlns:on="urn:galath:on"
          xmlns:class="urn:galath:class">

    <!-- components + application here -->

  </galath>
</script>

<!-- 5. Bootstrap JS + bogan-css interactivity -->
<script src="./node_modules/bogan-css/product/js/bootstrap.bundle.min.js"></script>
<script type="module" src="./node_modules/bogan-css/product/js/components.js"></script>

<!-- 6. Boot galath -->
<script type="module">
  import { boot } from 'galath/boot';
  await boot({
    source: document.getElementById('galath-source').textContent,
    mount:  document.getElementById('mount'),
  });
</script>
```

### Critical path note
`bogan/node_modules/galath` is the **workspace root** of the galath monorepo.
The actual runtime source lives one level deeper at
`packages/galath/src/index.js`. The import map must point there, not to
`node_modules/galath/src/index.js` (which does not exist at the workspace root).

---

## Galath XML — Core Concepts

### Namespaces you always need
```xml
<galath version="1.0"
        xmlns:bind="urn:galath:bind"
        xmlns:on="urn:galath:on"
        xmlns:class="urn:galath:class">
```
Add `xmlns:drag="urn:galath:drag"` and `xmlns:drop="urn:galath:drop"` only if
you need drag-and-drop.

### Component shape
```xml
<component name="my-widget" tag="x-my-widget" prop1="default">
  <model>
    <signal name="count" value="0" />
  </model>
  <view>
    <button on:click="set('count', count + 1)">{count}</button>
  </view>
</component>
```
- `name` is the logical name; `tag` is the custom-element tag used in markup.
- Props declared as attributes on `<component>` become reactive signals seeded
  from attributes on the usage site (`<x-my-widget prop1="hello" />`).
- Presentational (no model) components omit the `<model>` block entirely.

### Reactive signals
```xml
<signal name="activeStory" value="basic" />
```
Read in expressions as bare names (`activeStory`). Mutate with:
```xml
on:click="set('activeStory', 'validation')"
```
Or two-way bind a form control:
```xml
<select bind:value="activeStory"> ... </select>
```

### Conditional rendering — `<if>` and `<switch>`
Use `<if>` for simple boolean gates:
```xml
<if test="activeTab === 'controls'">
  <div class="cf-control-grid"> ... </div>
</if>
```

Use `<switch>` when branching on a discrete value (cleaner than chained `<if>`):
```xml
<switch on="activeStory">
  <case value="basic">      <x-story-form-basic />      </case>
  <case value="validation"> <x-story-form-validation /> </case>
  <case value="floating">   <x-story-form-floating />   </case>
</switch>
```

### Reactive class toggling — `class:`
Add or remove a class based on an expression without touching the static `class`
attribute:
```xml
<a class="cf-tree-item"
   class:is-active="activeStory === 'basic'"
   href="#"
   on:click="set('activeStory', 'basic')">
  Basic
</a>
```
The static `class` attribute sets the permanent classes; `class:` directives
layer additions on top.

### Interpolation
```xml
<span>Ready — Bootstrap / Form / {activeStory}</span>
```
Curly-brace expressions are evaluated in the component's signal scope.

### Repeaters
```xml
<!-- Low-level: iterate a node-set -->
<repeat ref="/todos/todo" as="todo">
  <div><text value="$todo/@text" /></div>
</repeat>

<!-- High-level: use a named datatemplate -->
<items source="/todos/todo" as="todo" template="todo-card" />
```

---

## Using bogan-css Without Conflict

bogan-css `components.js` uses DOM event delegation and class toggling for:
- `data-cf-search` — filters `[data-cf-label]` tree items
- `data-cf-toggle-docs` — toggles `.cf-docs-panel.is-hidden`
- `data-cf-toggle-addons` — toggles `.cf-addon-panel.is-collapsed`
- `data-cf-fullscreen` — toggles `.cf-workbench.is-fullscreen`
- `data-cf-theme` — sets `data-bs-theme` on `<html>`
- `data-cf-tab` / `data-cf-pane` — addon panel tab switching

### The conflict zone
galath uses incremental DOM morphing to apply reactive updates. If bogan-css JS
adds a class (e.g., `.is-active` on an addon tab) and galath later morphs the
same element with a view that does not include that class, galath will remove it.

**Rule of thumb:** anything inside a galath `<view>` that changes reactively
must be driven by galath signals + `class:` directives, not by bogan-css JS.

**Safe pattern used in bogan:**
- Story tree `.is-active` → managed by `class:is-active="activeStory === 'X'"`
- Addon panel tabs `.is-active` → managed by galath `activeTab` signal
- Toolbar toggles (docs, addons, fullscreen) → managed by bogan-css JS (the
  elements are static in galath's view, so no morph conflict)
- Search → fully handled by bogan-css JS (`data-cf-search` / `data-cf-label`)
- Theme toggle → fully handled by bogan-css JS (`data-cf-theme`)

---

## XML Validity — What Bites You

All content inside `<galath>` is parsed as XML. HTML habits that break it:

| HTML habit | Valid XML equivalent |
|---|---|
| `<input>` | `<input />` |
| `<br>` | `<br />` |
| `novalidate` | `novalidate="novalidate"` |
| `selected` | `selected="selected"` |
| `checked` | `checked="checked"` |
| `<` in expressions | `&amp;lt;` or restructure |
| `&&` in expressions | `&amp;&amp;` |
| Unquoted attributes | Always quote: `value="x"` |

---

## The bogan-css Shell — Minimum Viable Structure

```html
<div class="cf-app">
  <header class="cf-header"> ... </header>

  <div class="cf-workbench has-docs">
    <aside class="cf-sidebar cf-scrollbar">
      <nav class="cf-tree">
        <div class="cf-tree-group">
          <div class="cf-tree-label">Category</div>
          <a class="cf-tree-item is-active" href="#" data-cf-label="searchable name">
            Story name
          </a>
        </div>
      </nav>
    </aside>

    <main class="cf-center">
      <div class="cf-toolbar"> ... </div>
      <section class="cf-canvas">
        <div class="cf-preview-frame">
          <div class="cf-preview-card">
            <!-- story renders here -->
          </div>
        </div>
      </section>
      <section class="cf-addon-panel"> ... </section>
    </main>

    <aside class="cf-docs-panel"> ... </aside>
  </div>

  <footer class="cf-statusbar"> ... </footer>
</div>
```

Add `.has-docs` on `.cf-workbench` to show the right docs column.  
Add `.is-collapsed` on `.cf-addon-panel` to hide it initially.

---

## Story Components — The Design Pattern

Each story variant is a **pure presentational component** — no model, just a
view that renders the component being demonstrated:

```xml
<component name="story-form-basic" tag="x-story-form-basic">
  <view>
    <!-- The actual Bootstrap component being demonstrated, no wrappers needed -->
    <form>
      <div class="mb-3">
        <label for="name" class="form-label">Full Name</label>
        <input type="text" class="form-control" id="name" placeholder="Jane Doe" />
      </div>
      <button type="submit" class="btn btn-primary">Submit</button>
    </form>
  </view>
</component>
```

The **app component** holds the signal and switches between stories:

```xml
<component name="bogan-app" tag="x-bogan-app">
  <model>
    <signal name="activeStory" value="basic" />
  </model>
  <view>
    <!-- sidebar tree item switches the signal -->
    <a class="cf-tree-item"
       class:is-active="activeStory === 'basic'"
       on:click="set('activeStory', 'basic')"
       data-cf-label="form basic">Basic</a>

    <!-- canvas switches on the signal -->
    <switch on="activeStory">
      <case value="basic">      <x-story-form-basic />      </case>
      <case value="validation"> <x-story-form-validation /> </case>
    </switch>
  </view>
</component>
```

---

## Controls Pane — Wiring a `<select>` as a Knob

The addon panel's Controls tab can expose story props as interactive controls
using `bind:value` on a `<select>`:

```xml
<if test="activeTab === 'controls'">
  <div class="cf-control-grid">
    <label class="cf-control">
      <span class="cf-control-label">variant <code>string</code></span>
      <select class="form-select form-select-sm" bind:value="activeStory">
        <option value="basic">basic</option>
        <option value="validation">validation</option>
        <option value="floating">floating</option>
      </select>
    </label>
  </div>
</if>
```

Changing the select updates `activeStory` which re-renders the canvas — the same
signal is shared between the sidebar tree, the toolbar breadcrumb, the canvas
switch, and the controls knob.

---

## File Layout After This Session

```
bogan/
  index.html          ← the bogan workshop (start here)
  GALATH-SKILL.md     ← this document
  node_modules/
    bogan-css/
      product/
        css/components-fantasyui.min.css   ← include this for the shell UI
        js/bootstrap.bundle.min.js
        js/components.js
    galath/
      packages/galath/src/
        index.js    ← galath runtime (referenced by import map)
        boot.js     ← boot() entry point
```

---

## Quick Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page, no mount | XML parse error in galath source | Open devtools, look for DOMParser errors |
| `import` fails | Import map path wrong | Point to `packages/galath/src/`, not root `src/` |
| `bi-*` icons missing | CSS not loaded | Check path to `components-fantasyui.min.css` |
| `.is-active` flickers off | galath morph wiping bogan-css JS classes | Manage that class via `class:is-active="expr"` instead |
| Boolean attr error | `novalidate` not quoted | Use `novalidate="novalidate"` |
| `&&` in expression breaks XML | Unescaped `&` | Use `&amp;&amp;` or restructure |
