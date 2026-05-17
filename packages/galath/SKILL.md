# SKILL.md — Building Galath Applications

A field guide for AI agents asked to write or modify Galath applications.
Galath is an XML language for the browser. There is no bundler, no transpiler,
no virtual DOM. The runtime is ~1500 lines of JavaScript loaded over a native
import map; everything else is XML the browser parses with `DOMParser`.

If you only have time to read three sections, read **Boot Pattern**,
**XML Pragmatics**, and **File Strategy** — those three are where new
agents most often produce broken code.

---

## 1. Boot Pattern

Every Galath page is the same five-piece skeleton. Copy it verbatim and edit
only the parts called out below.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">

  <!-- (A) Any CSS you want. Galath has no opinion. -->
  <link rel="stylesheet" href="./node_modules/galath-css/css/bootstrap.min.css">

  <!-- (B) Native import map. Point the bare specifier 'galath' at the
       package's local source. -->
  <script type="importmap">
    {
      "imports": {
        "galath":      "./node_modules/galath/src/index.js",
        "galath/boot": "./node_modules/galath/src/boot.js"
      }
    }
  </script>
</head>
<body>
  <!-- (C) Mount point. The application renders inside this div. -->
  <div id="mount"></div>

  <!-- (D) Galath source. Browser ignores this MIME type; boot() reads it
       as text and parses it with DOMParser. -->
  <script type="application/xml" id="galath-source">
    <galath version="1.0"
            xmlns:bind="urn:galath:bind"
            xmlns:on="urn:galath:on"
            xmlns:use="urn:galath:use"
            xmlns:class="urn:galath:class"
            xmlns:drag="urn:galath:drag"
            xmlns:drop="urn:galath:drop">

      <!-- imports + components + application go here -->

      <application name="app">
        <x-root />
      </application>
    </galath>
  </script>

  <!-- (E) Two-line boot. -->
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

**Critical:** the import-map path is `./node_modules/galath/src/index.js`,
not `./src/index.js`. The short form only works inside the galath package
itself. From any consumer app, always use the `./node_modules/galath/...`
form.

If the source has a parse error, `boot()` renders a red error panel into the
mount element (with line/column from `DOMParser`) before re-throwing. You
will see exactly what went wrong instead of a blank page.

---

## 2. XML Pragmatics

Galath sources are parsed as XML, not HTML. Your output **must** be
well-formed XML or the page is blank. Common mistakes:

| Wrong (HTML habit)         | Right (XML)                    | Why |
|----------------------------|--------------------------------|-----|
| `<input>`                  | `<input />`                    | self-close void elements |
| `<br>`                     | `<br />`                       | |
| `selected`                 | `selected="selected"`          | unquoted boolean attrs are invalid |
| `selected="{expr}"`        | `selected="{expr}"`            | boolean attrs from expressions work — see §10 |
| `count > 0 && enabled`     | `count > 0 and enabled`        | `&` must be escaped — write `and`/`or` |
| `a < b`                    | `a &lt; b`                     | `<` must be escaped inside attributes |
| `&middot;` `&hellip;`      | `&#xB7;` `&#x2026;`            | XML only predefines `&amp; &lt; &gt; &quot; &apos;` |

The five namespace declarations on `<galath>` are **mandatory** if you use
any colon-prefixed attribute (`bind:`, `on:`, `class:`, `use:`, `drag:`,
`drop:`). Without them DOMParser rejects the document.

`and` and `or` are accepted as aliases for `&&` and `||` in every Galath
expression. Prefer them — your XML stays readable and you do not have to
write `&amp;&amp;`.

Long blocks of JavaScript belong in `<eval><![CDATA[ ... ]]></eval>` so you
do not have to escape `<`, `>`, and `&` by hand.

---

## 3. Components — Anatomy

```xml
<component name="counter" tag="x-counter" step="1">
  <style>
    .panel { border: 1px solid #ccc; padding: .5rem; }
  </style>

  <model>
    <signal   name="count"   value="0" />
    <signal   name="label"   value="Hits" />
    <computed name="parity"  from="count">count % 2 === 0 ? 'even' : 'odd'</computed>

    <instance>
      <history>
        <entry at="boot" />
      </history>
    </instance>

    <bind ref="/history/entry/@at" required="true" />
  </model>

  <commandset>
    <command name="bump" shortcut="ctrl+arrowup">
      <set signal="count" value="count + Number(step)" />
    </command>
  </commandset>

  <controller>
    <action name="reset">
      <set signal="count" value="0" />
    </action>
  </controller>

  <listeners>
    <listener signal="count">
      <store signal="count" key="'counter:count'" />
    </listener>
  </listeners>

  <on:mount>
    <restore signal="count" key="'counter:count'" default="0" />
  </on:mount>

  <on:unmount>
    <log value="'counter unmounted with ' + count" />
  </on:unmount>

  <view>
    <div class="panel">
      <strong>{label}</strong>
      <span>{count} ({parity})</span>
      <button command="bump">+ {step}</button>
      <button on:click="#reset">Reset</button>
    </div>
  </view>
</component>
```

- `name` is the logical name. `tag` is the custom-element tag used in markup.
  If you omit `tag`, the runtime uses `xes-${name}`.
- **Attributes on `<component>` declare props.** Their value is the default.
  At usage time, attributes flow into same-named signals.
- All the inner sections are optional. A component can be just `<view>...</view>`.

Once registered, the tag is a real Custom Element. You can drop it into any
HTML, not just other Galath views.

---

## 4. Signals and Computed

### Signal — the reactive cell

```xml
<signal name="count" value="0" />
<signal name="raw"><![CDATA[<some-large-default-with-special-chars/>]]></signal>
```

Read in any expression by bare name (`count`). Mutate from a handler with
`set('count', count + 1)` or from an operation with `<set signal="count"
value="count + 1" />`.

Values are coerced on entry: `"true"`/`"false"` → boolean, `"12.5"` → number.
String values are passed through. Use a `<computed>` if you want a richer
transform.

### Computed — derived signal

```xml
<computed name="parity" from="count">
  count % 2 === 0 ? 'even' : 'odd'
</computed>
```

The body is an expression. `from` names the source signal (or comma-separated
list of sources for multi-input computeds — see below). `value` is also in
scope as an alias for the single source's value.

Computed re-evaluates whenever any source changes.

### Multi-source computed (galath ≥ 1.0.6)

```xml
<signal name="first" value="Ada" />
<signal name="last"  value="Lovelace" />
<computed name="full" from="first, last">first + ' ' + last</computed>
```

`from` accepts a comma-separated list; subscribe to all named signals.

---

## 5. Instance Tree and Paths

State that has shape — lists, records, configuration — belongs in an
`<instance>` rather than scattered signals. Every attribute is reactive.

```xml
<instance>
  <todos>
    <todo id="t1" text="Write docs"   done="false" />
    <todo id="t2" text="Ship release" done="true"  />
  </todos>
</instance>
```

Address nodes with a strict XPath subset:

| Path | Meaning |
|---|---|
| `/todos/todo` | every `todo` child of `/todos` |
| `/todos/todo[@id=t1]` | predicate by attribute equality |
| `/todos/todo[2]` | 1-based index predicate |
| `/todos/todo/@text` | attribute value (read/write) |
| `/todos/todo/text()` | element text content (read/write) |
| `$todo` | local variable from `<repeat as="todo">` |
| `$todo/@text` | attribute on a local variable |
| `*` | wildcard element name (in a step) |

Unsupported by design: descendant axis (`//`), function calls beyond
`text()`, multi-step predicates. If you need more, reach for a
`<computed>` — that is the pressure valve.

---

## 6. Bindings — connecting view to state

All bindings are XML attributes. They are namespaced so the renderer can
tell them apart from plain HTML attributes.

### `bind:property="signal|path"` — two-way bind

```xml
<input bind:value="email" />                <!-- writes to signal `email` -->
<input bind:value="/user/@email" />         <!-- writes to instance path -->
<input type="checkbox" bind:checked="agreed" />
<textarea bind:value="body"></textarea>
<select bind:value="role">
  <option value="viewer">Viewer</option>
  <option value="admin">Admin</option>
</select>
<input type="date"   bind:value="when" />
<input type="number" bind:value="age"  />   <!-- value is numeric -->
```

### `on:event="code | #action | #command"` — one-way event

```xml
<button on:click="set('count', count + 1)">+</button>
<button on:click="#submit">Submit</button>           <!-- controller action -->
<button on:input="set('q', $event.target.value)">...</button>
```

`$event` is in scope; standard DOM event fields are reachable
(`$event.target`, `$event.currentTarget.dataset`, `$event.key`, …).

### `class:name="expr"` — toggle a class

```xml
<a class="cf-tree-item"
   class:is-active="activeId === id"
   on:click="set('activeId', id)">
  Item
</a>
```

Static `class="..."` and any number of `class:` directives may coexist on
one element. The runtime emits a single merged `class="..."` attribute and
tracks ownership in `data-xes-classes` so external JavaScript can also
mutate the class list without being clobbered on re-render.

### `use:behavior="value"` — attached behavior

```xml
<button use:copy="snippet">Copy</button>
<input  use:focus="isEditing" bind:value="draft" />
<textarea use:autosize bind:value="body" />
```

Built-in behaviors: `copy`, `focus`, `autosize`. Register more with
`language.behaviors.set('name', fn)`.

### `drag:source="payload"` / `drop:target="payload"` / `drop:command="cmd"`

```xml
<li drag:source="$todo">{$todo/@text}</li>
<ul drop:target="$bucket" drop:command="moveTodo">…</ul>
```

The configured command receives `$source` / `$target` as locals.

### `command="name"` — wire a button to a command

```xml
<button command="save">Save</button>
```

Auto-disables when the command's `enabled` predicate is falsy.

### `{expr}` — attribute interpolation

```xml
<a href="/u/{userId}" title="View {name}">…</a>
```

The expression is evaluated, HTML-escaped, and substituted. Use plain XML
text (no curly braces) when you only need a static value.

---

## 7. Boolean Attributes

Every standard HTML boolean attribute supports `attr="{expr}"`. The runtime
evaluates the expression and emits the attribute name only when truthy:

```xml
<button disabled="{loading}">Submit</button>
<input  required="{isAdmin}" />
<select multiple="{allowMany}">…</select>
<form   novalidate="{not strict}">…</form>
<option selected="{value === current}">…</option>
```

Recognized: `allowfullscreen async autofocus autoplay checked controls
default defer disabled formnovalidate hidden ismap loop multiple muted
nomodule novalidate open readonly required reversed selected
typemustmatch`.

---

## 8. Conditional Rendering

### `<if test="expr">`

```xml
<if test="loading">
  <span>Loading…</span>
  <else>
    <span>Ready</span>
  </else>
</if>
```

`<else>` is optional. Multiple `<else>` blocks render in order — useful for
"empty / error / content" splits.

### `<switch on="expr">`

```xml
<switch on="status">
  <case value="loading"> <x-spinner /> </case>
  <case value="error">   <x-error message="{err}" /> </case>
  <case test="status.startsWith('ok')"> <x-success /> </case>
  <default>              <x-idle /> </default>
</switch>
```

`<case value="...">` compares string-equal. `<case test="...">` evaluates
a boolean expression. The first match wins; if nothing matches and a
`<default>` exists, it renders.

---

## 9. Lists, Templates, Keys

### Inline `<repeat>`

```xml
<repeat ref="/todos/todo" as="todo" key="$todo/@id">
  <li>
    <input type="checkbox" bind:checked="$todo/@done" />
    <text value="$todo/@text" />
  </li>
</repeat>
```

Iteration locals (every name is available both as `name` and `$name`):
- `as`-name and `$as`-name → the loop item (an XNode)
- `index`, `$index` → zero-based offset
- `first`, `$first` → `true` on the first iteration
- `last`,  `$last`  → `true` on the final iteration
- `count`, `$count` → total iteration count

### Reusable `<datatemplate>` + `<items>`

```xml
<datatemplate name="todo-row" for="todo" key="$todo/@id">
  <li>
    <text value="$todo/@text" />
    <button on:click="deleteNode($todo)">×</button>
  </li>
</datatemplate>

<ul>
  <items source="/todos/todo" template="todo-row" as="todo" />
</ul>
```

The template can be defined anywhere in the component definition and
instantiated multiple times.

### Keys

Add `key="..."` to any repeater (or its datatemplate) to opt in to
identity-based reconciliation. The renderer stamps each row with
`data-xes-key`; the morph layer reorders existing DOM nodes instead of
overwriting them. This preserves input focus, scroll, and any transient
DOM state across reorders.

Keys can sit on `<repeat>`, on `<items>`, or on `<datatemplate>` (where
they become the default for every `<items>` that uses the template).

---

## 10. Slots — host content projection

```xml
<component name="card-shell" tag="x-card-shell" title="Card">
  <view>
    <div class="card">
      <header>{title}</header>
      <slot>
        <em>(no content supplied)</em>
      </slot>
    </div>
  </view>
</component>

<!-- Usage -->
<x-card-shell title="Greeting">
  <p>Whatever the host writes here lands inside the slot.</p>
</x-card-shell>

<!-- No content -> default fallback inside <slot> renders -->
<x-card-shell title="Empty" />
```

Galath has one default slot per component. Captured DOM is **moved**, not
cloned, so any listeners the host attached survive. The slot wrapper is
stamped `data-xes-frozen` so subsequent renders leave its children alone.

---

## 11. Lifecycle Hooks

```xml
<on:mount>
  <restore signal="theme" key="'app:theme'" default="'light'" />
  <call action="loadInitialData" />
</on:mount>

<on:unmount>
  <log value="'goodbye'" />
</on:unmount>
```

Both accept the same operations as commands and controller actions. Inside
`<eval>`, `this` is the component element (the `HTMLElement` instance) so
you can stash timers and listener handles on it for cleanup.

For long-running JS work inside `<on:mount>`, always wrap in
`<eval><![CDATA[ ... ]]></eval>` and stash handles on `this` so
`<on:unmount>` can tear them down. **Resolve signals via
`this.scope.signal('name')` rather than the `set()` helper** if your code
will run after the eval's `with(ctx)` scope is gone (timer callbacks,
event listeners). The signal object reference is captured by closure;
`set()` is not.

---

## 12. Operations

Used inside `<on:mount>`, `<on:unmount>`, `<action>`, `<command>`, and
inline `<listener>`s.

| Operation | Purpose |
|---|---|
| `<set signal="x" value="expr" />` | Update a named signal |
| `<setvalue ref="/path/@attr" value="expr" />` | Write to an instance path |
| `<insert ref="/parent"><child .../></insert>` | Append child(ren) to a tree node |
| `<delete ref="/path[@pred]" />` | Remove matching tree node(s) |
| `<call action="name" />` | Invoke another controller action by name |
| `<log value="expr" />` | Console debug |
| `<eval>...js...</eval>` | Escape hatch — arbitrary JS in scope |
| `<store signal="x" key="'k'" />` | Persist signal to localStorage |
| `<restore signal="x" key="'k'" default="expr" />` | Hydrate from localStorage |
| `<emit name="my-event" detail="expr" bubbles="true" composed="false" />` | Dispatch CustomEvent on the host |
| `<fetch url="expr" into="sig" as="json\|text\|response" method="GET" body="expr" headers="expr" loading="sig" error="sig" />` | Async HTTP |

Operations are interpreted in document order, synchronously, except
`<fetch>` and `<emit>` which dispatch asynchronously.

---

## 13. Controllers and Commands

### Controller — named actions

```xml
<controller>
  <action name="addTodo">
    <insert ref="/todos">
      <todo id="{uid()}" text="{valueOf('/draft/@text')}" done="false" />
    </insert>
    <setvalue ref="/draft/@text" value="''" />
  </action>
</controller>
```

Call from a handler: `on:click="#addTodo"`.

### Command — reusable, enable-gated

```xml
<commandset>
  <command name="save" enabled="isDirty" shortcut="ctrl+s">
    <set signal="isDirty" value="false" />
  </command>

  <command name="addTodo"
           shortcut="ctrl+enter"
           enabled="valueOf('/draft/@text').trim().length > 0">
    <insert ref="/todos">
      <todo id="{uid()}" text="{valueOf('/draft/@text')}" done="false" />
    </insert>
    <setvalue ref="/draft/@text" value="''" />
  </command>
</commandset>

<button command="save">Save</button>
```

Buttons attached via `command="..."` inherit the `enabled` predicate's
disabled state automatically. The keyboard `shortcut` is global; it fires
even when the focus is elsewhere, except inside plain `<input>`/`<textarea>`
when the shortcut has no modifier key.

---

## 14. Listeners — reacting without polling

### Data-tree events

```xml
<listeners>
  <listener event="xforms-insert"        observer="/todos" handler="#onAdd" />
  <listener event="xforms-delete"        observer="/todos" handler="#onRemove" />
  <listener event="xforms-value-changed" observer="/todos">
    <set signal="dirty" value="true" />
  </listener>
  <listener event="*"> <!-- any data-tree mutation --></listener>
</listeners>
```

Available types: `xforms-insert`, `xforms-delete`, `xforms-value-changed`,
`*`. `observer="/path"` filters by path prefix. `handler="#actionName"`
delegates; omit it to inline operations as children of the listener.

`$event` is in scope: `type`, `path`, `node`, `parent`, `attribute`,
`oldValue`, `value`.

### Signal-change

```xml
<listeners>
  <listener signal="theme" handler="#applyTheme" />
  <listener signal="pinned">
    <store signal="pinned" key="'app:pinned'" />
  </listener>
</listeners>
```

Fires whenever the named signal changes value. `$value` is the new value
(also available as a plain `value` local).

---

## 15. Behaviors — attached, disposable

Built-ins:

```xml
<button use:copy="snippet">Copy</button>        <!-- click-to-clipboard -->
<input  use:focus="isEditing" bind:value="d" /> <!-- focus when truthy -->
<textarea use:autosize bind:value="body" />     <!-- grow with content -->
```

Register your own from a feature plugin:

```js
language.behaviors.set('hover', (element, value, instance, local) => {
  const onEnter = () => instance.scope.signal('hovered').value = true;
  const onLeave = () => instance.scope.signal('hovered').value = false;
  element.addEventListener('mouseenter', onEnter);
  element.addEventListener('mouseleave', onLeave);
  return new language.Disposable(() => {
    element.removeEventListener('mouseenter', onEnter);
    element.removeEventListener('mouseleave', onLeave);
  });
});
```

Return a `Disposable`; the renderer cleans it up on the next render.

---

## 16. Cross-Component Communication

### Down: `bind:from-parent` — child mirrors a parent signal

```xml
<x-child bind:from-parent="activeId" />

<!-- inside the child component -->
<view>The current id is {activeId}.</view>
```

Read-only mirror. The parent owns the source of truth; changes flow down.
A child can also read a parent signal in any expression via
`parentSignal('name')`.

### Up: `<emit>` — child dispatches a custom event

```xml
<!-- inside the child component -->
<controller>
  <action name="pick">
    <emit name="rated" detail="Number($event.currentTarget.dataset.star)" />
  </action>
</controller>

<!-- parent listens -->
<x-star-rating on:rated="set('rating', $event.detail)" />
```

`<emit>` dispatches a `CustomEvent` on the component's host element.
Parents listen with `on:event-name` exactly like any DOM event. The detail
payload arrives as `$event.detail`.

---

## 17. Validation

```xml
<model>
  <instance>
    <signup name="" email="" age="" />
  </instance>

  <bind ref="/signup/@name"  required="true" />
  <bind ref="/signup/@email" required="true" type="email" />
  <bind ref="/signup/@age"   type="integer"
                             constraint="Number(value) >= 13 and Number(value) &lt;= 120" />
</model>

<view>
  <input class="form-control {invalid('/signup/@email') ? 'is-invalid' : ''}"
         bind:value="/signup/@email" />
  <button disabled="{invalid('/signup/@name') or invalid('/signup/@email') or invalid('/signup/@age')}">
    Submit
  </button>
</view>
```

Expression helpers:
- `valid(path)` — `true` when every applicable bind passes.
- `invalid(path)` — inverse.
- `required(path)` — `true` when the path is currently required.
- `validity(path)` — `{value, required, type, constraint, valid}` summary
  for targeted error messages.

Built-in `type` values: `email`, `number`, `integer`, `url`, `date`.
`constraint` is a boolean expression with the current value bound to
`value`.

---

## 18. Persistence

Canonical pattern — copy this exactly:

```xml
<on:mount>
  <restore signal="theme" key="'app:theme'" default="'light'" />
</on:mount>

<listeners>
  <listener signal="theme">
    <store signal="theme" key="'app:theme'" />
  </listener>
</listeners>
```

`<restore>` runs once on mount; the signal-change listener writes on every
subsequent change. `key` is an expression — wrap fixed names in quotes or
compute per-user / per-document keys.

---

## 19. Imports — splitting the document

```xml
<galath version="1.0">
  <import src="./components/card.xml" />
  <import src="./chapters/dashboard.xml" />

  <application name="app">
    <x-dashboard />
  </application>
</galath>
```

Imports are resolved at boot, recursively, and cached by absolute URL. The
fetched file's root may be `<galath>` / `<fragment>` / `<xes>` (children are
spliced in) or any single element (which is spliced in itself). Nested
imports are resolved relative to the importing file's URL.

If a fetch fails, a visible `<parseerror>` element is injected in place of
the import and the failure is logged to the console.

---

## 20. Operations on the Instance Tree from JavaScript

Expressions inside `<eval>` and inline handlers can use helpers:

| Helper | Purpose |
|---|---|
| `uid()` | Short unique id (`n…`), useful for inserted nodes |
| `select(path)` | Array of XNodes |
| `valueOf(path)` | Value at the path (string / number / boolean) |
| `set(name, value)` | Update a signal |
| `attr(node, name)` | Read attribute on an XNode |
| `setNode(node, name, value)` | Write attribute on an XNode |
| `deleteNode(node)` | Remove an XNode |
| `parentSignal(name)` | Read a signal in the nearest parent component |
| `valid(path)`, `invalid(path)`, `required(path)`, `validity(path)` | Validation helpers |
| `$event` | The triggering DOM event (or null) |

---

## 21. File Strategy — splitting wisely

A single 2000-line XML document is unreadable for humans and exhausting for
AIs. Galath's `<import>` is your modularity primitive. Use it.

**Guidelines** (these are conventions, not rules — break them when the code
asks):

- **One component per file** at the leaf level. The file name matches the
  component name (`./components/card-shell.xml` contains
  `<component name="card-shell" tag="x-card-shell">`).
- **Group by feature** in folders: `./components/`, `./chapters/`, `./forms/`,
  `./layouts/`. Inside `./components/` keep files small (~100–200 lines);
  bigger files break into sub-files via imports.
- **Index file at the entry**: the `<script type="application/xml">` in
  `index.html` is mostly `<import>` lines plus the `<application>` entry
  point. It is the table of contents, not the table.
- **Shared building blocks first** in the import list. Each subsequent
  import can rely on tags the earlier imports registered.
- **Keep the `<application>`thin.** It should be a one-liner that
  instantiates the root component. All real logic lives in `<component>`s.

Every Galath file you write must begin with the namespace declarations:

```xml
<galath xmlns:bind="urn:galath:bind"
        xmlns:on="urn:galath:on"
        xmlns:use="urn:galath:use"
        xmlns:class="urn:galath:class"
        xmlns:drag="urn:galath:drag"
        xmlns:drop="urn:galath:drop">
  <!-- components, datatemplates, etc -->
</galath>
```

If a chapter file contains a single component, that's the root. If it
contains a shared datatemplate and two components, declare them as siblings
inside `<galath>` — imports splice all of `<galath>`'s children in at the
import point.

---

## 22. Expressions in Detail

Two parsers run inside Galath: the **path parser** (a strict XPath subset,
see §5) and the **JavaScript evaluator** (`Function('ctx', 'with(ctx) {
return (expr); }')`).

The runtime picks the cheap path first: if the expression is a bare signal
name, a `/abs/path`, or a `$local`, it skips JS entirely. Otherwise the
expression is compiled as JavaScript and evaluated with a Proxy-backed
context that exposes:

- every signal name as a property holding its value (recorded for
  fine-grained re-render subscriptions),
- every loop-local (`$todo`, `index`, `first`, …),
- helper functions (§20),
- `$event` (when an event is in flight).

Bare globals (`Number`, `String`, `Math`, `JSON`, `Date`, …) fall through to
the outer scope, so you can call `Number(value)`, `JSON.stringify(...)`,
`new Date().toISOString()` etc. directly inside expressions.

When the evaluator throws, the runtime logs to the console and returns a
fallback (an empty string for interpolations, the previous signal value
for setters). One broken attribute does not blank the page.

---

## 23. Error Modes and Debugging

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page with red overlay | XML parse error | The overlay shows the DOMParser message with line/column. Look for unescaped `&`, unclosed tags, or missing namespaces. |
| `import fails: failed to load …` | Wrong path in `<import src>` | Paths are relative to the importing file's URL. |
| Console: `no controller action named "…"` | Typo in `on:click="#name"` | Action handlers must start with `#`. |
| Console: `expression failed: …` | JS error inside an expression | Read the message; the broken expression is logged verbatim. |
| Component renders empty | Missing `<application>` or wrong tag | Check `application` block and the component's `tag` attribute. |
| `<fetch>` silently does nothing | `into` signal not declared | Declare a `<signal name="..." value="" />` in `<model>` first. |
| `<select>` shows wrong initial option | `bind:value="signal"` was authored as a literal | Confirm the signal name is correct and the option `value` matches. |
| `<input>` resets value while typing | Reset happens because morph cannot tell it apart | Check that the input is bound (`bind:value`); unbound inputs reset on every render. |
| Boolean attr renders as `attr="true"` | Wrote a plain attribute, not `{expr}` | Use `disabled="{loading}"` not `disabled="loading"`. |
| `data-xes-classes` keeps reverting | External JS is fighting galath | OK as long as you use `class:` directives and external code touches a class galath does not own. If you must own both, manage from one side only. |

---

## 24. Recipes

### Todo app (instance tree + commands + listeners)

```xml
<component name="todo-app" tag="x-todo-app">
  <model>
    <signal name="draft" value="" />
    <instance>
      <todos />
    </instance>
  </model>

  <commandset>
    <command name="add" enabled="draft.trim().length > 0" shortcut="ctrl+enter">
      <insert ref="/todos">
        <todo id="{uid()}" text="{draft}" done="false" />
      </insert>
      <set signal="draft" value="''" />
    </command>
  </commandset>

  <view>
    <input bind:value="draft" placeholder="What to do?" />
    <button command="add">Add</button>

    <ul>
      <repeat ref="/todos/todo" as="todo" key="$todo/@id">
        <li>
          <input type="checkbox" bind:checked="$todo/@done" />
          <text value="$todo/@text" />
          <button on:click="deleteNode($todo)">×</button>
        </li>
      </repeat>
    </ul>
  </view>
</component>
```

### Data-fetching with loading / error / retry

```xml
<component name="user-card" tag="x-user-card" userId="1">
  <model>
    <signal name="user"    value="" />
    <signal name="loading" value="false" />
    <signal name="error"   value="" />
  </model>

  <controller>
    <action name="load">
      <fetch url="'https://api.example.com/users/' + userId"
             into="user"
             loading="loading"
             error="error" />
    </action>
  </controller>

  <on:mount>
    <call action="load" />
  </on:mount>

  <view>
    <if test="loading">Loading…</if>
    <if test="error">
      <div>
        <span>{error}</span>
        <button on:click="#load">Retry</button>
      </div>
    </if>
    <if test="!loading and !error and user">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </if>
  </view>
</component>
```

### Tabs with reactive content

```xml
<component name="tabs-demo" tag="x-tabs-demo">
  <model><signal name="tab" value="overview" /></model>

  <view>
    <nav>
      <button class="{tab === 'overview' ? 'active' : ''}" on:click="set('tab','overview')">Overview</button>
      <button class="{tab === 'usage' ? 'active' : ''}"    on:click="set('tab','usage')">Usage</button>
      <button class="{tab === 'api' ? 'active' : ''}"      on:click="set('tab','api')">API</button>
    </nav>
    <switch on="tab">
      <case value="overview"><p>What this thing is.</p></case>
      <case value="usage">   <p>How to use it.</p></case>
      <case value="api">     <p>Reference.</p></case>
    </switch>
  </view>
</component>
```

### Modal owned by parent, dismissed by child via `<emit>`

```xml
<component name="modal" tag="x-modal">
  <controller>
    <action name="dismiss">
      <emit name="close" />
    </action>
  </controller>
  <view>
    <div class="backdrop" on:click="#dismiss">
      <div class="dialog" on:click="$event.stopPropagation()">
        <slot />
        <button on:click="#dismiss">Close</button>
      </div>
    </div>
  </view>
</component>

<!-- Host -->
<component name="page" tag="x-page">
  <model><signal name="open" value="false" /></model>
  <view>
    <button on:click="set('open', true)">Open</button>
    <if test="open">
      <x-modal on:close="set('open', false)">
        <h2>Hello</h2>
        <p>Anything you put here lands in the slot.</p>
      </x-modal>
    </if>
  </view>
</component>
```

---

## 25. Don't

These are mistakes new agents repeat. Don't.

- **Don't use HTML self-closing forms for non-void tags.** `<div />` is invalid
  XML's-equivalent — it parses as `<div>` followed by nothing. The morph layer
  will misalign. Always write `<div></div>`.
- **Don't forget the namespace declarations.** Every file that uses any
  colon-prefixed attribute must declare the namespaces on its `<galath>` root.
- **Don't write JS inline when an operation exists.** `<set>`, `<setvalue>`,
  `<insert>`, `<delete>`, `<fetch>`, `<store>`, `<restore>`, `<emit>`,
  `<call>` cover 95% of needs and read better.
- **Don't compute view state with `<eval>`.** That's what `<computed>` is for.
- **Don't write a single big file.** Split. Keep files under ~200 lines unless
  a single component genuinely needs more.
- **Don't put markup in signal values that you intend to render as HTML.**
  Signals are interpolated with HTML escaping. If you need to display source
  text (a code example), that's fine — it stays escaped. If you need to
  inject markup, write a component for it.
- **Don't bundle galath into a build pipeline.** Galath assumes the source
  is delivered as a `<script type="application/xml">` tag and `boot()`
  reads it as text. Bundlers that transform XML break this contract.
- **Don't add external npm dependencies to the runtime.** Galath ships
  zero-deps on purpose. New features go in `src/` and stay dependency-free.

---

## 26. Reference — package layout

```
galath/
├─ src/
│  ├─ index.js                ← public surface; re-exports features
│  ├─ boot.js                 ← boot() — the 99% entry point
│  ├─ core.js                 ← language container + XML parse
│  ├─ signals.js              ← Signal / Scope / Concern / Disposable
│  ├─ instance-model.js       ← XNode / XTree / paths / coerce
│  ├─ binding.js              ← evaluate / interpolate / escapeHtml
│  ├─ command.js              ← <commandset> + shortcuts
│  ├─ controller.js           ← <controller> + operations
│  ├─ templates.js            ← <datatemplate> registry
│  ├─ behavior.js             ← use:copy / use:focus / use:autosize / drag/drop
│  ├─ xml-events.js           ← <listeners>: data-tree + signal-change
│  ├─ imports.js              ← <import src="…">
│  ├─ component.js            ← <component> → Custom Element
│  ├─ rendering.js            ← render → HTML string → morph
│  └─ morph.js                ← surgical DOM updater
├─ playground/
│  ├─ app.xml                 ← chapter shell
│  ├─ chapters/               ← one chapter per file
│  └─ components/             ← shared pieces (highlighter, run-snippet)
├─ index.html                 ← playground entry
├─ AGENTS.md                  ← short, evolving notes for AI editors
├─ TUTORIAL.md                ← long-form human tutorial
├─ SKILL.md                   ← this document
└─ README.md
```

Read `AGENTS.md` for any temporary advice the project owner has left for
agents. It supersedes anything in this skill if it conflicts.
