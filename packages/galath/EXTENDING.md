# Extending Galath

Galath is built as a composition of *features*. Every capability — signals,
bindings, the operation interpreter, the renderer — is a plain function that
mutates the `language` object. You extend the runtime the same way: write a
feature function, plug it in with `.use()`, and the new capability is live.

---

## How `.use()` works

`createLanguage()` returns an object with a `use(feature)` method. A feature
is any function that accepts the `language` object and adds methods or state to
it. The return value of the feature is ignored; everything happens via mutation.

```js
function myFeature(language) {
  language.myHelper = () => 'hello';
}

const language = createLanguage({ source, mount })
  .use(coreFeature)
  // … standard features …
  .use(myFeature)          // ← your feature, inserted in order
  .use(renderingFeature);

await language.start();
```

### Feature ordering rules

| Rule | Reason |
|---|---|
| `coreFeature` must be first | Every other feature calls `language.parseSource` |
| `renderingFeature` must be last | It calls helpers added by every earlier feature |
| Your feature goes just before `renderingFeature` | Unless it adds helpers that rendering depends on — then move it earlier |

---

## The three extension hooks

There are three places you can hook into without touching the source.

### Hook 1 — New operations

Operations are the XML elements inside `<action>`, `<command>`, `<on:mount>`,
and `<on:unmount>` blocks — things like `<set>`, `<insert>`, `<delete>`. They
are all run by `language.runOperations`. To add your own, wrap that function:
handle the tags you own, then pass everything else to the original.

```js
function myFeature(language) {
  const orig = language.runOperations;

  language.runOperations = (ops, instance, local = {}, event = null) => {
    const unhandled = [];

    for (const op of ops) {
      if (op.nodeType !== Node.ELEMENT_NODE) { unhandled.push(op); continue; }

      if (op.localName === 'my-op') {
        // handle <my-op foo="expr" /> here
      } else {
        unhandled.push(op);
      }
    }

    if (unhandled.length) orig(unhandled, instance, local, event);
  };
}
```

The original loop handles its own node-type guard, so passing `unhandled`
directly is safe — you already filtered it the same way.

---

### Hook 2 — New expression helpers

Galath expressions (inside `{…}` interpolations and `on:click="…"` handlers)
run inside a `with(ctx)` block. The context object is built by
`language.buildContext`. To inject your own helpers, wrap that function and
return a Proxy that adds your names before delegating to the original:

```js
function myFeature(language) {
  const orig = language.buildContext;

  language.buildContext = (instance, local = {}, event = null) => {
    const ctx = orig(instance, local, event);
    const extras = {
      double: x => x * 2,
    };
    return new Proxy(ctx, {
      get(target, key) {
        if (key in extras) return extras[key];
        return Reflect.get(target, key);
      },
      has(target, key) {
        return key in extras || Reflect.has(target, key);
      },
    });
  };
}
```

Once installed, `{double(21)}` in any template resolves to `42`, and
`on:click="set('x', double(x))"` works the same way.

---

### Hook 3 — New render tags

`language.renderChildren(nodes, instance, local, bindings)` is called for
every child list in the rendered view. To add structural tags like `<repeat>`,
`<if>`, or `<switch>` already have, wrap that function and intercept the nodes
you own before delegating the rest:

```js
function myFeature(language) {
  const orig = language.renderChildren;

  language.renderChildren = (nodes, instance, local, bindings) => {
    const parts = [];

    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'my-tag') {
        parts.push(myTagRenderer(node, instance, local, bindings));
      } else {
        parts.push(orig([node], instance, local, bindings));
      }
    }

    return parts.join('');
  };

  function myTagRenderer(node, instance, local, bindings) {
    // return an HTML string
    return `<div>…</div>`;
  }
}
```

The renderer always returns an HTML string; the morph layer applies it to the
live DOM. Stamp any element you emit with a unique `data-xes-id` if you need
post-render bindings (event listeners, behaviors). See `rendering.js` for how
the standard tags do it.

---

## Worked example: a collection feature

Here is a complete, self-contained feature that adds three new *operations* and
three matching *expression helpers* for transforming arrays stored in signals.

### What it adds

**Operations** (inside `<action>`, `<command>`, `<on:mount>`):

```xml
<map    signal="out" source="arr" fn="item * 2" />
<filter signal="out" source="arr" fn="item % 2 === 0" />
<reduce signal="out" source="arr" fn="acc + item" initial="0" />
```

- `source` — name of a signal whose value is an array
- `signal` — name of the signal to write the result into
- `fn`     — a Galath expression; has `item` and `index` in scope
  (`<reduce>` also has `acc`)
- `initial` — (`<reduce>` only) starting accumulator value

**Context helpers** (inside `{…}` and `<eval>…</eval>`):

```xml
<eval>set('out', collect.map(arr, x => x * 2))</eval>
```

`collect.map`, `collect.filter`, `collect.reduce` are plain JS functions
available anywhere an expression runs.

---

### The feature source

```js
// src/collection-feature.js

export function collectionFeature(language) {

  // ── Operations ─────────────────────────────────────────────────────────────

  const origOps = language.runOperations;

  language.runOperations = (ops, instance, local = {}, event = null) => {
    const unhandled = [];

    for (const op of ops) {
      if (op.nodeType !== Node.ELEMENT_NODE) { unhandled.push(op); continue; }

      const name = op.localName;

      if (name === 'map' || name === 'filter' || name === 'reduce') {
        const sourceVal = language.evaluate(
          op.getAttribute('source') ?? '[]', instance, local, [], event,
        );
        const arr = Array.isArray(sourceVal) ? sourceVal : [];
        const fn = op.getAttribute('fn') ?? 'item';
        const outSig = instance.scope.signal(op.getAttribute('signal') ?? '');
        if (!outSig) continue;

        if (name === 'map') {
          outSig.value = arr.map((item, index) =>
            language.evaluate(fn, instance, { ...local, item, index }, item, event),
          );

        } else if (name === 'filter') {
          outSig.value = arr.filter((item, index) =>
            language.evaluate(fn, instance, { ...local, item, index }, false, event),
          );

        } else {
          const initialExpr = op.getAttribute('initial') ?? 'undefined';
          let acc = language.evaluate(initialExpr, instance, local, undefined, event);
          for (const [index, item] of arr.entries()) {
            acc = language.evaluate(
              fn, instance, { ...local, acc, item, index }, acc, event,
            );
          }
          outSig.value = acc;
        }
        continue;
      }

      unhandled.push(op);
    }

    if (unhandled.length) origOps(unhandled, instance, local, event);
  };

  // ── Expression helpers ─────────────────────────────────────────────────────

  const origCtx = language.buildContext;

  language.buildContext = (instance, local = {}, event = null) => {
    const ctx = origCtx(instance, local, event);
    const collect = {
      map:    (arr, fn)       => Array.isArray(arr) ? arr.map(fn)            : [],
      filter: (arr, fn)       => Array.isArray(arr) ? arr.filter(fn)         : [],
      reduce: (arr, fn, init) => Array.isArray(arr) ? arr.reduce(fn, init)   : init,
    };
    return new Proxy(ctx, {
      get(target, key) {
        if (key === 'collect') return collect;
        return Reflect.get(target, key);
      },
      has(target, key) {
        return key === 'collect' || Reflect.has(target, key);
      },
    });
  };
}
```

---

### Registering the feature

`boot()` from `galath/boot` applies a fixed feature list. To insert your own
feature, do a manual boot instead (the same calls `boot` makes internally):

```js
import {
  createLanguage,
  coreFeature,
  signalsAndScopesFeature,
  instanceModelFeature,
  bindingFeature,
  commandFeature,
  controllerFeature,
  templateItemsFeature,
  behaviorFeature,
  xmlEventsFeature,
  importFeature,
  componentFeature,
  renderingFeature,
} from 'galath';

import { collectionFeature } from './src/collection-feature.js';

const language = createLanguage({ source, mount })
  .use(coreFeature)
  .use(signalsAndScopesFeature)
  .use(instanceModelFeature)
  .use(bindingFeature)
  .use(commandFeature)
  .use(controllerFeature)
  .use(templateItemsFeature)
  .use(behaviorFeature)
  .use(xmlEventsFeature)
  .use(importFeature)
  .use(componentFeature)
  .use(collectionFeature)    // ← just before rendering
  .use(renderingFeature);

await language.start();
```

---

### XML example — operations

```xml
<galath>
  <component name="crunch" tag="x-crunch">
    <model>
      <signal name="numbers"  value="[1, 2, 3, 4, 5, 6]" />
      <signal name="doubled"  value="[]" />
      <signal name="evens"    value="[]" />
      <signal name="total"    value="0" />
    </model>

    <controller>
      <action name="crunch">
        <map    signal="doubled" source="numbers" fn="item * 2" />
        <filter signal="evens"   source="numbers" fn="item % 2 === 0" />
        <reduce signal="total"   source="numbers" fn="acc + item" initial="0" />
      </action>
    </controller>

    <view>
      <button on:click="#crunch">Crunch</button>
      <p>Doubled: {doubled}</p>
      <p>Evens:   {evens}</p>
      <p>Total:   {total}</p>
    </view>
  </component>
</galath>
```

---

### XML example — `<eval>` with context helpers

`<eval>` runs arbitrary JS with the full expression context in scope. After
installing `collectionFeature`, `collect.map`, `collect.filter`, and
`collect.reduce` are available anywhere an expression runs — including inline
handlers:

```xml
<controller>
  <action name="crunch">
    <eval>
      set('doubled', collect.map(numbers, x => x * 2));
      set('evens',   collect.filter(numbers, x => x % 2 === 0));
      set('total',   collect.reduce(numbers, (acc, x) => acc + x, 0));
    </eval>
  </action>
</controller>
```

Or inline on a button if you need a one-liner:

```xml
<button on:click="set('doubled', collect.map(numbers, x => x * 2))">
  Double them
</button>
```

The difference between the two styles: operations (`<map>`, `<filter>`,
`<reduce>`) keep logic in reviewable XML. `<eval>` with `collect.*` is shorter
for one-off transforms and gives you the full JS arrow-function syntax.

---

## Design notes

**Why wrap instead of fork?**
Every hook works by saving the original function reference and delegating the
unhandled cases back to it. Multiple features can wrap the same function
independently; each layer peels off what it knows and passes the rest down.
Order of `.use()` calls determines which feature's handler runs first.

**Why no plugin registry?**
A plugin registry would be another thing to learn. The language object itself
*is* the registry — features add named methods, and the feature list is just
the `.use()` chain in boot order. If two features claim the same operation
name, the later `.use()` wins (its wrapper runs first and swallows the op).
Name your operations with a clear prefix to avoid collisions.

**When to use `<eval>` instead of a new operation**
`<eval>` is the built-in escape hatch. Use it when:
- You need something once or twice and a full feature is overkill.
- The logic is inherently imperative (multiple steps, conditionals).

Prefer a proper operation when:
- The same transform appears in many components.
- You want the behavior to be inspectable as XML (logs, devtools).
- You want the expression context helpers separate from the raw JS.
