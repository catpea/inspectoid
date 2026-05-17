- External npm dependencies are forbidden due to possibly supply chain attacks

## Import map path

The correct import map for any consumer app is always:

```json
"galath":      "./node_modules/galath/src/index.js",
"galath/boot": "./node_modules/galath/src/boot.js"
```

This works whether galath is installed from npm or linked as a workspace symlink — both
cases place `src/index.js` and `src/boot.js` directly under `node_modules/galath/`.

The playground HTML (`packages/galath/index.html`) uses `./src/index.js` because that
file lives physically inside `packages/galath/`. That short form is only valid from that
exact location. Do not copy it into a consumer app.

## Expression keywords

`and` and `or` are accepted as aliases for `&&` and `||` in all galath expressions.
This avoids having to write `&amp;&amp;` in XML attribute values.

## Boolean attributes

Any standard HTML boolean attribute (`novalidate`, `selected`, `required`, `readonly`,
`multiple`, `hidden`, …) can be written as `attr="{expr}"` in a galath view. When the
expression is truthy the attribute is emitted; when falsy it is omitted entirely.
There is no need to write `novalidate="novalidate"` for dynamic cases.

## localStorage persistence operations

Two controller operations persist signal values across page loads:

```xml
<store signal="theme" key="app:theme" />
<restore signal="theme" key="app:theme" default="'light'" />
```

`<restore>` reads the stored JSON and writes it to the signal; falls back to `default`
when nothing is stored (or on parse error). Use it in `<on:mount>`.

`<store>` writes the current signal value as JSON. Use it in a controller action or
inside an inline signal-change `<listener>`.

## Signal-change listeners

`<listener>` inside `<listeners>` now has two forms:

**Data-tree events** (original — requires `<instance>` data):
```xml
<listener event="xforms-insert" observer="/todos" handler="#onInsert" />
```

**Signal-change** (new — fires whenever a named signal's value changes):
```xml
<listener signal="theme" handler="#onThemeChange" />
<listener signal="pinned">
  <store signal="pinned" key="app:pinned" />
</listener>
```

`$value` is available in both the called action and inline operations.

### Canonical persistence pattern

```xml
<on:mount>
  <restore signal="theme" key="app:theme" default="'light'" />
</on:mount>
<listeners>
  <listener signal="theme">
    <store signal="theme" key="app:theme" />
  </listener>
</listeners>
```

## Error overlay

When the XML source is malformed, `boot()` renders a readable error panel into the
mount element (dark background, red text, parse error with line/column info) before
re-throwing. Authors see exactly what went wrong instead of a blank page.

## Multi-source `<computed>`

`from` accepts a comma-separated list of signal names; the body re-runs whenever
any source emits a change.

```xml
<signal name="first" value="Ada" />
<signal name="last"  value="Lovelace" />
<computed name="full" from="first, last">first + ' ' + last</computed>
```

The single-source form (`from="x"`) still works exactly as before. When `from` is
empty (or names only unknown signals) the computed falls back to the instance-tree
version counter so it still re-evaluates on any tree mutation.

## `<emit>` — child-to-parent custom events

```xml
<!-- Inside a child component -->
<emit name="rated" detail="Number($event.currentTarget.dataset.star)" />

<!-- Parent listens on the host element -->
<x-rating on:rated="set('rating', $event.detail)" />
```

Optional attributes: `bubbles="false"` (default `true`), `composed="true"`
(default `false`). `<emit>` works anywhere operations are valid: actions,
commands, on:mount, on:unmount, and inline listeners.

## `<fetch>` — method, body, headers

In addition to `url`, `into`, `loading`, `error`, and `as`:

- `method="POST"` — HTTP verb (default `GET`).
- `body="expr"` — evaluated expression. Plain objects are JSON-encoded with
  `Content-Type: application/json` auto-injected. Strings, `FormData`, `Blob`,
  `ArrayBuffer`, and `URLSearchParams` are sent as-is. `null` sends no body.
- `headers="expr"` — evaluated expression yielding a plain object. Merged with
  any auto-injected header. Case-insensitive collision detection.
- `as="response"` — write the raw `Response` object into the `into` signal
  (callers can then read it manually with `.text()` / `.blob()` / etc.).

## Iteration locals in `<repeat>` / `<items>`

Each iteration exposes (under both `name` and `$name` spellings):

| Local | Meaning |
|---|---|
| `as`-name | The loop item (XNode) |
| `index` | Zero-based offset |
| `first` | `true` on the first iteration |
| `last`  | `true` on the final iteration |
| `count` | Total iteration count |
