# Galath Tutorial

A complete, hands-on walk through Galath, from a blank HTML file to a real
application. By the end you will have built a small task tracker that
persists across page reloads, fetches data from the network, validates
input, and is split tidily across multiple files. Total reading time:
about 45 minutes; total typing time: a couple of hours, plus tea.

There are **fifteen chapters**. Each builds on the previous one — read top
to bottom and copy along.

> **Setup once.** Anywhere in the tutorial that you see code, you can paste
> it into the file we set up in Chapter 1 and refresh the page. There is no
> build step at any point.

---

## Table of Contents

1. [Hello, Galath](#chapter-1--hello-galath)
2. [Signals — your first reactive value](#chapter-2--signals)
3. [Computed values](#chapter-3--computed-values)
4. [Two-way bindings](#chapter-4--two-way-bindings)
5. [The instance tree — structured state](#chapter-5--the-instance-tree)
6. [Lists with `<repeat>` and `<datatemplate>`](#chapter-6--lists)
7. [Conditional rendering — `<if>` and `<switch>`](#chapter-7--conditionals)
8. [Components — your own custom elements](#chapter-8--components)
9. [Slots — letting hosts inject content](#chapter-9--slots)
10. [Controllers, commands, and keyboard shortcuts](#chapter-10--controllers-and-commands)
11. [Lifecycle and listeners](#chapter-11--lifecycle-and-listeners)
12. [Persistence with localStorage](#chapter-12--persistence)
13. [Async — fetching data with `<fetch>`](#chapter-13--async)
14. [Validation — `<bind>` and friends](#chapter-14--validation)
15. [Splitting an app across files](#chapter-15--splitting-the-app)

Appendix A. [Cheatsheet](#appendix-a--cheatsheet)
Appendix B. [Common errors and how to fix them](#appendix-b--troubleshooting)

---

## Chapter 1 — Hello, Galath

Galath ships as a regular npm package, but you do not need a bundler. The
runtime is loaded by the browser through a native import map, and your
application source is just an XML document inside the page.

### 1.1 Create the project

```sh
mkdir my-galath-app && cd my-galath-app
npm init -y
npm install galath
```

If you also want Bootstrap for styling (used through the rest of this
tutorial), add the optional CSS package:

```sh
npm install galath-css
```

Anything you can serve over HTTP will do. The simplest is the package's
own dev server:

```sh
npx http-server -c-1 -o
```

This opens `http://127.0.0.1:8080` in your browser and disables the
cache.

### 1.2 The entry page

Create `index.html` at the project root with **exactly** this content:

```html
<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Galath app</title>

  <link rel="stylesheet" href="./node_modules/galath-css/css/bootstrap.min.css">
  <link rel="stylesheet" href="./node_modules/galath-css/css/bootstrap-icons.min.css">

  <script type="importmap">
    {
      "imports": {
        "galath":      "./node_modules/galath/src/index.js",
        "galath/boot": "./node_modules/galath/src/boot.js"
      }
    }
  </script>
</head>
<body class="container py-4">
  <div id="mount"></div>

  <script type="application/xml" id="galath-source">
    <galath version="1.0"
            xmlns:bind="urn:galath:bind"
            xmlns:on="urn:galath:on"
            xmlns:use="urn:galath:use"
            xmlns:class="urn:galath:class"
            xmlns:drag="urn:galath:drag"
            xmlns:drop="urn:galath:drop">

      <component name="app" tag="x-app">
        <view>
          <h1>Hello, Galath!</h1>
          <p>Your application is alive. Refresh after edits.</p>
        </view>
      </component>

      <application name="my-app">
        <x-app />
      </application>
    </galath>
  </script>

  <script type="module">
    import { boot } from 'galath/boot';
    window.galath = await boot({
      source: document.getElementById('galath-source').textContent,
      mount:  document.getElementById('mount'),
    });
  </script>
</body>
</html>
```

Open it in your browser. You should see:

> # Hello, Galath!
> Your application is alive. Refresh after edits.

Five pieces are doing all the work:

1. The import map tells the browser where `galath` lives on disk.
2. `<div id="mount">` is where Galath will render.
3. The `<script type="application/xml">` block holds your Galath source.
   The browser does not run it; `boot()` reads it as text.
4. `<component name="app" tag="x-app">` registers a Custom Element.
5. `<application>` says "instantiate this once and put it in the mount".

If you see a red panel instead of the heading, you have an XML parse
error. The panel tells you the line and column. Common culprits:

- a `<` or `&` that needs escaping (`&lt;`, `&amp;`),
- a non-self-closing void tag (`<input>` should be `<input />`),
- a missing namespace declaration on `<galath>`.

### 1.3 What just happened

`boot()` does five things on startup:

1. **Parse.** It runs `DOMParser` on the source. A parse error surfaces
   immediately via the red overlay.
2. **Resolve imports.** Every `<import src="...">` is replaced by the
   children of the fetched XML file. Imports are recursive and cached.
3. **Register components.** Every `<component>` becomes a Custom Element.
4. **Run self-tests.** A handful of internal assertions. Failures log to
   `console.error` but do not block rendering.
5. **Mount the application.** The `<application>` block is serialized
   into the mount element, the browser instantiates the custom tags, and
   each component renders.

From here on every change you make is just a refresh away. Take a moment
to break something on purpose to see the error overlay — it is one of
Galath's nicer features.

---

## Chapter 2 — Signals

A **signal** is a reactive cell holding a single value. Whenever the value
changes, every view that reads it re-renders. Signals are the simplest
unit of state in Galath.

Replace your `<component name="app">` with:

```xml
<component name="app" tag="x-app">
  <model>
    <signal name="count" value="0" />
    <signal name="step"  value="1" />
  </model>

  <view>
    <h1>Count: {count}</h1>
    <button class="btn btn-info" on:click="set('count', count + step)">
      + {step}
    </button>
    <button class="btn btn-outline-secondary" on:click="set('count', 0)">
      Reset
    </button>
  </view>
</component>
```

Refresh and click the buttons. You will see the count change in the heading.

**What to notice:**

- `<signal name="count" value="0" />` declares a signal with initial value
  `0`. The runtime coerces `"0"` to the number `0`.
- `{count}` in the heading is **interpolation**. Anything between curly
  braces is a JavaScript expression evaluated in the component's scope.
- `on:click="set('count', count + step)"` is an event handler. `set()`
  is a built-in helper for "update a signal".

### 2.1 Multiple signals

Add a `step` control:

```xml
<view>
  <h1>Count: {count}</h1>

  <div class="d-flex gap-2 align-items-center">
    <label>Step</label>
    <input class="form-control w-auto" type="number" bind:value="step" />
    <button class="btn btn-info"
            on:click="set('count', count + step)">+ {step}</button>
    <button class="btn btn-outline-secondary"
            on:click="set('count', count - step)">- {step}</button>
  </div>
</view>
```

`bind:value="step"` is a **two-way bind**. Changing the input updates the
signal. Changing the signal updates the input. We will use binds heavily
in the chapters to come.

---

## Chapter 3 — Computed Values

Some values are derived from others. A `<computed>` is a read-only signal
whose value is an expression of one or more source signals; it
re-evaluates automatically whenever a source changes.

```xml
<model>
  <signal name="count" value="0" />
  <signal name="step"  value="1" />
  <computed name="doubled" from="count">count * 2</computed>
  <computed name="parity"  from="count">count % 2 === 0 ? 'even' : 'odd'</computed>
</model>

<view>
  <h1>Count: {count} ({parity})</h1>
  <p>Doubled: {doubled}</p>
  ...
</view>
```

**Multiple sources** — declare them in a comma-separated list:

```xml
<signal name="first" value="Ada" />
<signal name="last"  value="Lovelace" />
<computed name="full" from="first, last">first + ' ' + last</computed>
```

`<computed>` is not magical. Internally it subscribes to each named source
and re-evaluates the body whenever any source emits a change. The
dependency direction is explicit (you write `from="..."`); there is no
automatic tracking. That is intentional — you can always read the source
list at the top of the model and know what triggers a recompute.

---

## Chapter 4 — Two-Way Bindings

The `bind:property` directive connects a DOM property to a signal. The
value flows both ways.

```xml
<component name="app" tag="x-app">
  <model>
    <signal name="email"       value="" />
    <signal name="subscribed"  value="true" />
    <signal name="role"        value="editor" />
    <signal name="loudness"    value="5" />
    <signal name="bio"         value="" />
  </model>

  <view>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label">Email</label>
        <input class="form-control" type="email" bind:value="email" />
      </div>

      <div class="col-md-6">
        <label class="form-label">Role</label>
        <select class="form-select" bind:value="role">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div class="col-md-6">
        <div class="form-check">
          <input class="form-check-input" id="sub" type="checkbox" bind:checked="subscribed" />
          <label class="form-check-label" for="sub">Subscribe to updates</label>
        </div>
      </div>

      <div class="col-md-6">
        <label class="form-label">Volume: {loudness}</label>
        <input class="form-range" type="range" min="0" max="10"
               bind:value="loudness" />
      </div>

      <div class="col-12">
        <label class="form-label">Bio</label>
        <textarea class="form-control" rows="3" bind:value="bio"></textarea>
      </div>
    </div>

    <hr />

    <pre class="bg-dark text-info p-3 rounded">{JSON.stringify({email, subscribed, role, loudness, bio}, null, 2)}</pre>
  </view>
</component>
```

Type, click, drag — the live JSON dump at the bottom mirrors every change.

You can bind anything that is a settable DOM property: `value`, `checked`,
plus less common ones if you ever need them.

**`<input type="number">` is special:** Galath reads numeric inputs as
numbers (`element.valueAsNumber`) so a signal you bind to a number input
remains a number, not a string. The empty input maps to an empty string
to keep the form usable.

---

## Chapter 5 — The Instance Tree

A signal is a single cell. When you have many cells with the same shape —
items in a list, fields in a record — using one signal per cell becomes
awkward. Galath provides a **structured state** model: state as an XML
tree, with paths that look like a strict subset of XPath.

```xml
<component name="app" tag="x-app">
  <model>
    <instance>
      <user name="Ada" theme="dark">
        <prefs>
          <pref key="emails"   value="weekly" />
          <pref key="autosave" value="true"   />
        </prefs>
      </user>
    </instance>
  </model>

  <view>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Name</label>
        <input class="form-control" bind:value="/user/@name" />
      </div>
      <div class="col-md-4">
        <label class="form-label">Theme</label>
        <select class="form-select" bind:value="/user/@theme">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    </div>

    <hr />

    <p>
      Hello <strong>{valueOf('/user/@name')}</strong>!
      Your theme is <code>{valueOf('/user/@theme')}</code>.
    </p>
  </view>
</component>
```

`/user/@name` is a path. The `/user` step selects the `<user>` element
under the root; `/@name` reads its `name` attribute. The same path is
writable — `bind:value="/user/@name"` two-way binds it.

The reference for path syntax:

| Path | Meaning |
|---|---|
| `/foo`               | child named `foo` |
| `/foo/bar`           | grandchild |
| `/foo[@id=x]`        | predicate by attribute (equality) |
| `/foo[2]`            | 1-based index |
| `/foo/@bar`          | attribute value |
| `/foo/text()`        | element text |
| `$todo`              | local variable from a `<repeat as="todo">` |
| `$todo/@text`        | attribute on a local |
| `*`                  | wildcard element name in one step |

Unsupported by design: descendant axis (`//`), multi-step predicates,
function calls beyond `text()`. Reach for `<computed>` if you need more.

---

## Chapter 6 — Lists

A repeater renders its body once per item in a path's selection.

```xml
<component name="app" tag="x-app">
  <model>
    <instance>
      <library>
        <book title="The Phoenix Project" author="Gene Kim" read="true" />
        <book title="Designing Data-Intensive Applications" author="Martin Kleppmann" read="false" />
        <book title="A Philosophy of Software Design" author="John Ousterhout" read="true" />
      </library>
    </instance>
  </model>

  <view>
    <h2>My library
      <span class="badge text-bg-info">
        {select('/library/book[@read=true]').length} / {select('/library/book').length} read
      </span>
    </h2>

    <ul class="list-group">
      <repeat ref="/library/book" as="book">
        <li class="list-group-item d-flex align-items-center gap-2">
          <input type="checkbox" bind:checked="$book/@read" />
          <span class="flex-grow-1 {$book/@read ? 'text-decoration-line-through text-secondary' : ''}">
            <text value="$book/@title" />
          </span>
          <small class="text-secondary">by <text value="$book/@author" /></small>
        </li>
      </repeat>
    </ul>
  </view>
</component>
```

**What's new:**

- `<repeat ref="..." as="book">` iterates a selection. `$book` (and the
  bare name `book`) refer to the current item inside the loop.
- `<text value="$book/@title" />` is the safe way to print a value: it
  resolves the path and HTML-escapes the result. Use it instead of
  `{$book/@title}` when the value comes from user-supplied data.
- `bind:checked="$book/@read"` writes back to the instance tree.
- Inside the `<repeat>`, you also get `index`, `first`, `last`, `count`
  (and their `$` variants) as locals — handy for striping rows or
  numbering them.

### 6.1 Reusable templates with `<datatemplate>`

When the row gets non-trivial, extract it:

```xml
<datatemplate name="book-row" for="book" key="$book/@title">
  <li class="list-group-item d-flex align-items-center gap-2">
    <input type="checkbox" bind:checked="$book/@read" />
    <span class="flex-grow-1"><text value="$book/@title" /></span>
    <small class="text-secondary">by <text value="$book/@author" /></small>
  </li>
</datatemplate>

<ul class="list-group">
  <items source="/library/book" as="book" template="book-row" />
</ul>
```

Templates can be referenced from multiple `<items>` and survive reorders
gracefully — that's what `key="..."` enables. Without keys, the morph
layer matches rows by position; with keys, it matches by identity, so
input focus / scroll / state stays attached to the right row across
reorders, deletes, and inserts.

### 6.2 Adding and removing items

Inserts and deletes are explicit operations:

```xml
<button class="btn btn-info"
        on:click="set('draft', '')"
        ...>+ New</button>

<button class="btn btn-outline-danger"
        on:click="deleteNode($book)">×</button>
```

For something more reusable, see Chapter 10 — commands and controllers.

---

## Chapter 7 — Conditionals

### `<if>` and `<else>`

```xml
<if test="loggedIn">
  <p>Welcome, {name}.</p>
  <else>
    <p>Please sign in.</p>
  </else>
</if>
```

`test` is any expression. Multiple `<else>` blocks render in order (rare,
but useful for tri-state UIs).

### `<switch>`

```xml
<switch on="status">
  <case value="loading"> <x-spinner /> </case>
  <case value="error">   <x-error message="{err}" /> </case>
  <case test="status.startsWith('ok')"> <x-success /> </case>
  <default>              <x-idle /> </default>
</switch>
```

Use `<case value="...">` for literal string equality and `<case test="...">`
for a full boolean expression. The first match wins; `<default>` is
optional and renders when nothing matches.

---

## Chapter 8 — Components

Anything you can wrap in `<component>` becomes a real Custom Element. The
key wins:

- **Encapsulation.** Each component has its own signals and tree.
- **Reuse.** Mount the same component in three places, get three
  independent instances.
- **Style scoping.** A `<style>` block inside `<component>` is auto-scoped
  to that component's root.

```xml
<component name="counter-card" tag="x-counter-card" label="Counter" step="1">
  <style>
    .panel { border: 1px dashed rgba(255,255,255,.2); border-radius: .5rem; padding: 1rem; }
    .number { font-size: 2rem; font-weight: 600; }
  </style>

  <model>
    <signal name="count" value="0" />
  </model>

  <view>
    <div class="panel">
      <strong>{label}</strong>
      <div class="number text-info">{count}</div>
      <button class="btn btn-info"
              on:click="set('count', count + Number(step))">+ {step}</button>
    </div>
  </view>
</component>

<component name="app" tag="x-app">
  <view>
    <div class="row g-3">
      <div class="col-md-4"><x-counter-card label="Visitors" step="1"  /></div>
      <div class="col-md-4"><x-counter-card label="Score"    step="10" /></div>
      <div class="col-md-4"><x-counter-card label="Temperature" step="5" /></div>
    </div>
  </view>
</component>
```

**Props are signals.** Attributes you declare on `<component>` (with default
values) become signals of the same name. At usage time, attributes on the
host element seed those signals.

If you change a parent attribute that drives a child prop, the child's
signal updates and the child re-renders — flow happens for free.

---

## Chapter 9 — Slots

Sometimes a component should let the host decide *what* goes inside.
That's a slot.

```xml
<component name="card-shell" tag="x-card-shell" title="Card" tone="info">
  <style>
    .card { border: 1px solid var(--bs-border-color); border-radius: .5rem; overflow: hidden; }
    .head { padding: .5rem .9rem; font-weight: 600; }
    .body { padding: 1rem; }
  </style>

  <view>
    <div class="card text-bg-{tone}-subtle">
      <div class="head">{title}</div>
      <div class="body">
        <slot>
          <em>(no content supplied)</em>
        </slot>
      </div>
    </div>
  </view>
</component>

<!-- Usage -->
<x-card-shell title="Greeting" tone="info">
  <p>This paragraph lives inside the slot, supplied by the host.</p>
</x-card-shell>

<x-card-shell title="Empty" tone="warning" />
```

The host writes whatever it likes between `<x-card-shell>` and
`</x-card-shell>`; that content lands wherever the component declares
`<slot>`. If the host writes nothing, the slot's own children render as
default fallback content.

There is one default slot per component. If you need multiple injection
points, pass them as props or break the component into smaller pieces.

---

## Chapter 10 — Controllers and Commands

When you find yourself repeating `on:click="..."` with the same body,
extract a **controller action**:

```xml
<controller>
  <action name="addTodo">
    <insert ref="/todos">
      <todo id="{uid()}" text="{valueOf('/draft/@text')}" done="false" />
    </insert>
    <setvalue ref="/draft/@text" value="''" />
  </action>

  <action name="clearAll">
    <delete ref="/todos/todo" />
  </action>
</controller>

<view>
  <button on:click="#addTodo">Add</button>
  <button on:click="#clearAll">Clear all</button>
</view>
```

Actions hold operations: `<set>`, `<setvalue>`, `<insert>`, `<delete>`,
`<call>`, `<log>`, `<eval>`, `<store>`, `<restore>`, `<emit>`, `<fetch>`.

When you want **buttons that auto-disable based on a predicate** *and*
**keyboard shortcuts**, use a commandset:

```xml
<commandset>
  <command name="add"
           enabled="valueOf('/draft/@text').trim().length > 0"
           shortcut="ctrl+enter">
    <call action="addTodo" />
  </command>

  <command name="clear"
           enabled="select('/todos/todo').length > 0"
           shortcut="ctrl+shift+x">
    <call action="clearAll" />
  </command>
</commandset>

<button class="btn btn-info"          command="add">  Add (Ctrl+Enter)</button>
<button class="btn btn-outline-light" command="clear">Clear (Ctrl+Shift+X)</button>
```

Buttons attached to a command via `command="..."` inherit the
`enabled` predicate's disabled state automatically. The keyboard shortcut
fires globally; the runtime is careful not to poach typing in form
controls unless the shortcut has a modifier key.

---

## Chapter 11 — Lifecycle and Listeners

### `<on:mount>` and `<on:unmount>`

Lifecycle hooks run once per component instance.

```xml
<on:mount>
  <log value="'component mounted'" />
</on:mount>

<on:unmount>
  <log value="'component about to leave'" />
</on:unmount>
```

For setup that involves JavaScript (timers, platform listeners), drop
into `<eval>` and stash handles on `this` for teardown:

```xml
<on:mount>
  <eval><![CDATA[
    const now = this.scope.signal('now');
    this.__timer = setInterval(() => {
      now.value = new Date().toLocaleTimeString();
    }, 1000);
  ]]></eval>
</on:mount>

<on:unmount>
  <eval><![CDATA[
    clearInterval(this.__timer);
    this.__timer = null;
  ]]></eval>
</on:unmount>
```

**Tip:** resolve signals via `this.scope.signal('name')` (not the `set`
helper) when the code runs after the eval's `with(ctx)` block has exited
— timer callbacks, event listeners, fetch handlers. The signal reference
is captured by closure; helpers are not.

### Listeners

`<listener>`s react to changes you didn't trigger directly.

**Signal-change listener** — fires when a named signal changes:

```xml
<listeners>
  <listener signal="theme" handler="#applyTheme" />
  <listener signal="pinned">
    <store signal="pinned" key="'app:pinned'" />
  </listener>
</listeners>
```

**Data-tree event listener** — fires on instance-tree mutations:

```xml
<listeners>
  <listener event="xforms-insert"        observer="/todos" handler="#onInsert" />
  <listener event="xforms-delete"        observer="/todos" handler="#onDelete" />
  <listener event="xforms-value-changed" observer="/todos">
    <set signal="dirty" value="true" />
  </listener>
</listeners>
```

`observer="/path"` filters by path prefix. `event="*"` catches everything.
`$event` exposes `type`, `path`, `node`, `parent`, `attribute`,
`oldValue`, `value`.

---

## Chapter 12 — Persistence

Two operations move JSON between signals and `localStorage`. Both are
trivial; the canonical pattern is "restore on mount, store on change":

```xml
<model>
  <signal name="theme" value="light" />
  <signal name="todos" value="[]" />
</model>

<on:mount>
  <restore signal="theme" key="'app:theme'" default="'light'" />
  <restore signal="todos" key="'app:todos'" default="[]" />
</on:mount>

<listeners>
  <listener signal="theme"><store signal="theme" key="'app:theme'" /></listener>
  <listener signal="todos"><store signal="todos" key="'app:todos'" /></listener>
</listeners>
```

A few things worth knowing:

- `key` is an **expression**, not a literal. Wrap fixed names in quotes
  (`key="'app:theme'"`) or compute them per-user, per-document, etc.
- `default` is also an expression. Use `"0"` for the number zero,
  `"'light'"` for the string `light`, `"[]"` for an empty array, etc.
- Stored values are JSON-encoded. Whatever round-trips through
  `JSON.stringify` / `JSON.parse` is safe to persist.

If the user blocks storage (private mode, full quota), `<store>` silently
no-ops and the app still works.

---

## Chapter 13 — Async

`<fetch>` wraps `window.fetch` with signal-aware loading and error states.
No async JavaScript required.

### GET

```xml
<component name="user-card" tag="x-user-card" userId="1">
  <model>
    <signal name="user"    value="" />
    <signal name="loading" value="false" />
    <signal name="error"   value="" />
  </model>

  <controller>
    <action name="load">
      <fetch url="'https://jsonplaceholder.typicode.com/users/' + userId"
             into="user"
             loading="loading"
             error="error" />
    </action>
  </controller>

  <on:mount>
    <call action="load" />
  </on:mount>

  <view>
    <if test="loading"><p>Loading…</p></if>
    <if test="error">
      <div class="alert alert-danger">
        {error} <button class="btn btn-sm btn-outline-light ms-2" on:click="#load">Retry</button>
      </div>
    </if>
    <if test="!loading and !error and user">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </if>
  </view>
</component>
```

### POST with a JSON body

```xml
<controller>
  <action name="createPost">
    <fetch url="'https://jsonplaceholder.typicode.com/posts'"
           method="POST"
           body="{ title: title, body: body, userId: 1 }"
           into="created"
           loading="loading"
           error="error" />
  </action>
</controller>
```

When the `body` evaluates to a plain object, Galath JSON-encodes it and
automatically adds `Content-Type: application/json` (unless you provided
one in `headers`). When it's a string, `FormData`, `Blob`, or
`URLSearchParams`, it's sent as-is. When it's `null`, no body is sent.

`<fetch>` is **fire-and-forget**. Operations after it in the same block
run synchronously, before the response resolves. If you need to react to
the eventual result, use a signal-change `<listener>` on the `into`
signal.

---

## Chapter 14 — Validation

Bring validation rules into the model. The view reads validity state
through expression helpers and uses it to style fields or block
submission.

```xml
<component name="signup-form" tag="x-signup-form">
  <model>
    <instance>
      <signup name="" email="" age="" agreed="false" />
    </instance>

    <bind ref="/signup/@name"   required="true" />
    <bind ref="/signup/@email"  required="true" type="email" />
    <bind ref="/signup/@age"    type="integer"
                                constraint="Number(value) >= 13 and Number(value) &lt;= 120" />
    <bind ref="/signup/@agreed" constraint="value === true" />
  </model>

  <view>
    <form novalidate="novalidate" class="row g-3">
      <div class="col-md-6">
        <label class="form-label">Name</label>
        <input class="form-control {invalid('/signup/@name') ? 'is-invalid' : ''}"
               bind:value="/signup/@name" />
        <div class="invalid-feedback">Required.</div>
      </div>

      <div class="col-md-6">
        <label class="form-label">Email</label>
        <input class="form-control {invalid('/signup/@email') ? 'is-invalid' : ''}"
               bind:value="/signup/@email" />
        <div class="invalid-feedback">
          <if test="validity('/signup/@email').value === ''">Email is required.</if>
          <if test="validity('/signup/@email').value !== '' and !validity('/signup/@email').type">
            That doesn&apos;t look like an email.
          </if>
        </div>
      </div>

      <div class="col-md-4">
        <label class="form-label">Age</label>
        <input class="form-control {invalid('/signup/@age') ? 'is-invalid' : ''}"
               bind:value="/signup/@age" />
        <div class="invalid-feedback">Must be a whole number between 13 and 120.</div>
      </div>

      <div class="col-md-8 d-flex align-items-end">
        <div class="form-check">
          <input class="form-check-input {invalid('/signup/@agreed') ? 'is-invalid' : ''}"
                 id="ag" type="checkbox" bind:checked="/signup/@agreed" />
          <label class="form-check-label" for="ag">I agree to the terms</label>
        </div>
      </div>

      <div class="col-12">
        <button class="btn btn-primary"
                disabled="{invalid('/signup/@name') or invalid('/signup/@email') or invalid('/signup/@age') or invalid('/signup/@agreed')}">
          Submit
        </button>
      </div>
    </form>
  </view>
</component>
```

**`<bind>`** declares rules:
- `required="..."` — boolean expression; truthy means the value must be non-empty.
- `type="..."` — one of `email`, `number`, `integer`, `url`, `date`.
- `constraint="..."` — boolean expression; `value` is the current path
  value inside it.

**View-side helpers** read validity state:
- `valid(path)` — `true` when every bind passes.
- `invalid(path)` — inverse of `valid`.
- `required(path)` — whether the path is currently required.
- `validity(path)` — the full summary object
  `{value, required, type, constraint, valid}`.

---

## Chapter 15 — Splitting the App

A single XML document is fine for a tutorial. Real apps want to split
across files. Galath's modularity primitive is `<import>`.

### The shape of a real project

```
my-app/
├─ index.html
├─ src/
│  ├─ app.xml                ← the shell component
│  ├─ components/
│  │  ├─ counter-card.xml
│  │  ├─ card-shell.xml
│  │  └─ user-card.xml
│  └─ chapters/
│     ├─ dashboard.xml
│     ├─ settings.xml
│     └─ help.xml
└─ package.json
```

### The entry

```html
<script type="application/xml" id="galath-source">
  <galath version="1.0"
          xmlns:bind="urn:galath:bind"
          xmlns:on="urn:galath:on"
          xmlns:use="urn:galath:use"
          xmlns:class="urn:galath:class">

    <!-- shared building blocks first -->
    <import src="./src/components/card-shell.xml" />
    <import src="./src/components/counter-card.xml" />
    <import src="./src/components/user-card.xml" />

    <!-- views -->
    <import src="./src/chapters/dashboard.xml" />
    <import src="./src/chapters/settings.xml" />
    <import src="./src/chapters/help.xml" />

    <!-- the app shell ties everything together -->
    <import src="./src/app.xml" />

    <application name="my-app">
      <x-app />
    </application>
  </galath>
</script>
```

### A typical leaf file (`src/components/counter-card.xml`)

```xml
<galath xmlns:on="urn:galath:on">
  <component name="counter-card" tag="x-counter-card" label="Counter" step="1">
    <style>
      .panel { border: 1px dashed rgba(255,255,255,.2); border-radius: .5rem; padding: 1rem; }
      .number { font-size: 2rem; font-weight: 600; }
    </style>

    <model>
      <signal name="count" value="0" />
    </model>

    <view>
      <div class="panel">
        <strong>{label}</strong>
        <div class="number text-info">{count}</div>
        <button class="btn btn-info"
                on:click="set('count', count + Number(step))">+ {step}</button>
      </div>
    </view>
  </component>
</galath>
```

**Rules of thumb:**

- One component per file at the leaves. The file name should match the
  component's `name`.
- Every Galath file starts with the namespace declarations on `<galath>`.
- The fetched file's `<galath>` wrapper is **invisible** — its children
  splice in at the import point. You only see `<galath>` in source.
- Imports cycle-detect by URL; importing the same file twice reuses one
  network round-trip and one parse.
- Imports inside a chapter file are resolved relative to that chapter
  file's URL, not the entry document.
- Keep `index.html`'s embedded `<galath>` mostly as imports + the
  `<application>`. The shell is the table of contents, not the table.

### When a `<style>` lives across files

`<style>` blocks inside a component are auto-prefixed with the
component's tag, so two files can both define `.panel` rules without
conflict. The runtime emits one prefixed stylesheet per component into
`<head>` the first time the component is registered.

If you want a *shared* stylesheet, link it from `<head>` the normal HTML
way. Galath has no opinion about external CSS.

---

## Appendix A — Cheatsheet

### Quick reference

| Want to … | Write |
|---|---|
| Hold a reactive value | `<signal name="x" value="0" />` |
| Derive a value | `<computed name="y" from="x">x * 2</computed>` |
| Two-way bind an input | `<input bind:value="x" />` |
| Handle a click | `<button on:click="set('x', x + 1)">+</button>` |
| Call a named action | `<button on:click="#actionName">Go</button>` |
| Toggle a class | `<div class:active="x > 0">…</div>` |
| Iterate a list | `<repeat ref="/items/item" as="it">…</repeat>` |
| Branch | `<if test="x > 0">A<else>B</else></if>` |
| Switch | `<switch on="x"><case value="a">A</case>…</switch>` |
| Slot in a host | `<x-card><p>content</p></x-card>` |
| Listen to a signal | `<listener signal="x" handler="#onChange" />` |
| Listen to tree change | `<listener event="xforms-insert" observer="/foo">…</listener>` |
| Run on mount | `<on:mount>…</on:mount>` |
| Run on unmount | `<on:unmount>…</on:unmount>` |
| Persist a signal | `<restore signal="x" key="'k'" default="0"/>` + signal listener with `<store>` |
| Fetch JSON | `<fetch url="..." into="result" loading="loading" error="error"/>` |
| Validate a field | `<bind ref="/path" required="true" type="email"/>` + `valid(...)`/`invalid(...)` |
| Custom event from child | `<emit name="changed" detail="value"/>` (parent: `on:changed="..."`) |
| Read parent signal | `parentSignal('name')` |
| Mirror parent signal | `<x-child bind:from-parent="active" />` |
| Split into files | `<import src="./path/to/file.xml" />` |

### Built-in expression helpers

| Helper | Purpose |
|---|---|
| `set(name, v)` | Update a signal |
| `select(path)` | Array of XNodes at the path |
| `valueOf(path)` | Value at the path |
| `attr(node, name)` | Read attribute on an XNode |
| `setNode(node, n, v)` | Write attribute on an XNode |
| `deleteNode(node)` | Remove an XNode |
| `parentSignal(name)` | Read a signal in the nearest parent component |
| `uid()` | Short unique id |
| `valid(path)`, `invalid(path)`, `required(path)`, `validity(path)` | Validation helpers |
| `$event` | The triggering DOM event (when applicable) |

### Iteration locals (inside `<repeat>` / `<items>`)

| Name | Meaning |
|---|---|
| `as`-name and `$as`-name | The loop item |
| `index`, `$index`        | Zero-based offset |
| `first`, `$first`        | `true` on first iteration |
| `last`, `$last`          | `true` on final iteration |
| `count`, `$count`        | Total number of items |

### Operations (inside `<action>`, `<command>`, `<on:mount>`, …)

| Operation | Purpose |
|---|---|
| `<set signal="x" value="…"/>` | Update a signal |
| `<setvalue ref="/p/@a" value="…"/>` | Write to instance |
| `<insert ref="/parent">…</insert>` | Append child(ren) |
| `<delete ref="/path"/>` | Remove node(s) |
| `<call action="name"/>` | Invoke another action |
| `<log value="…"/>` | Console output |
| `<eval>…js…</eval>` | Arbitrary JS escape hatch |
| `<store signal="x" key="…"/>` | Persist to localStorage |
| `<restore signal="x" key="…" default="…"/>` | Hydrate from localStorage |
| `<fetch url="…" into="x" method="…" body="…" headers="…" loading="…" error="…" as="json\|text\|response"/>` | Async HTTP |
| `<emit name="…" detail="…" bubbles="true" composed="false"/>` | Dispatch CustomEvent on the host |

### Boolean attributes that accept `attr="{expr}"`

`allowfullscreen`, `async`, `autofocus`, `autoplay`, `checked`,
`controls`, `default`, `defer`, `disabled`, `formnovalidate`, `hidden`,
`ismap`, `loop`, `multiple`, `muted`, `nomodule`, `novalidate`, `open`,
`readonly`, `required`, `reversed`, `selected`, `typemustmatch`.

---

## Appendix B — Troubleshooting

### "I see a red panel"

The XML did not parse. The panel shows the `DOMParser` error with line
and column. Common causes:

- a `<` or `&` inside an attribute (escape them: `&lt;`, `&amp;`),
- a void tag not self-closed (`<input>` → `<input />`),
- a namespace prefix used without declaring `xmlns:name="..."` on
  `<galath>`,
- mismatched element nesting (open `<div>` with no close).

For inline JavaScript blocks, prefer
`<eval><![CDATA[ ... ]]></eval>` so you do not have to escape characters.

### "An attribute renders as the literal text"

You probably wrote `disabled="loading"` instead of `disabled="{loading}"`.
Boolean attributes accept expressions only when wrapped in braces.

### "My signal is `undefined` in a JS callback inside `<eval>`"

The `set` and `valueOf` helpers live inside the eval's `with(ctx)` block.
Once the callback fires (a timer tick, a fetch handler), that scope is
gone. Resolve the signal once at the top of the eval:

```xml
<eval><![CDATA[
  const sig = this.scope.signal('now');
  setInterval(() => { sig.value = Date.now(); }, 1000);
]]></eval>
```

### "External JS keeps fighting Galath over the same class"

Galath tracks the classes it owns in `data-xes-classes` and uses a
**surgical merge** when morphing — external classes survive. Make sure
you use `class:` directives for classes you want Galath to own, and let
external code manage the rest.

### "`<repeat>` renders nothing"

Either:
- `ref` does not match anything (`select('/path')` returns `[]`), or
- the component has no `<instance>` declared, so `tree.select(...)` is
  always empty.

### "My `<select>` shows the wrong initial option"

Confirm the bound signal's value matches one of the `<option value="...">`
attributes exactly. Galath ≥ 1.0.6 seeds the initial `.value` property
on the live element on first render so `bind:value` works even on
non-existing-in-attribute selects.

### "My component does not register"

Check the browser console. The most likely cause is a typo in the
`<component>`/`<import>` chain — the runtime logs an `import failed`
or `unknown tag` warning. Also: a tag name with no hyphen (`<counter>`)
will not be a Custom Element. Galath defaults to `xes-${name}` when you
omit `tag`, so this only happens if you set `tag="counter"` explicitly.

### "I see `[galath] expression failed: ...`"

A JavaScript expression inside an attribute or `{...}` threw. The
runtime returned a fallback (empty string or previous signal value) so
the page is not blanked, but the warning tells you which expression
broke and why.

---

## What next

- Open the **playground** (`npm run serve` in this directory) to see every
  feature running in real, editable form.
- Read **SKILL.md** if you are an AI agent (or a senior dev) and want a
  dense, structured spec without prose.
- Read **README.md** for the motivation behind the language.
- Hack the runtime. It is fifteen short JavaScript files in `src/`, each
  with a top-of-file header explaining what it does. No build step, no
  dependencies, no tooling required — just open the file and read.

Have fun. Build something real. Tell us what broke and we will fix it.
