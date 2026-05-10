# Galath Strong Core

An XML manifesto for the age of AI.

Galath is a small language for web applications. It treats UI, state, events,
commands, components, imports, and instance data as explicit XML structure.
The goal is not nostalgia. The goal is a stronger substrate for humans and
machines to read, edit, verify, and extend.

```xml
<component name="counter" tag="x-counter">
  <model>
    <signal name="count" value="0" />
    <signal name="step" value="1" />
  </model>

  <view>
    <button on:click="set('count', count + step)">+</button>
    <span>Count: {count}</span>
    <input type="number" bind:value="step" />
  </view>
</component>
```

## The Claim

AI does not need less structure. It needs better structure.

The web became powerful by accepting strings everywhere: HTML strings, CSS
strings, JavaScript strings, JSON strings, template strings, build config
strings. That freedom made software easy to start and hard to reason about.
Every agent, editor, linter, compiler, and reviewer must infer the shape of
the program from conventions.

Galath makes the shape visible.

```xml
<model> declares state.</model>
<view> declares the interface.</view>
<controller> names behavior.</controller>
<commandset> names intent.</commandset>
<instance> carries structured data.</instance>
<import> composes documents.</import>
```

This is the strong core: a small number of explicit concepts, each with a
clear place in the document.

## Principles

**Structure before cleverness.** A Galath document should be inspectable by a
person, a browser, a test, or an AI agent without first reverse-engineering a
framework's private conventions.

**State is named.** Dynamic values live in signals or in the XML instance tree.
When something changes, the path to that change is visible.

**Behavior is addressable.** Inline event code exists, but durable behavior can
be named in controllers and commands.

**Composition is document-level.** Features can live in separate XML files and
arrive through `<import>`, not through a bundler ceremony.

**The runtime stays small.** Galath has no external npm dependencies. The
project favors readable platform code over supply-chain reach.

**Escapes are explicit.** Expressions are JavaScript expressions in a scoped
context. Paths are a strict XPath-like subset. When the language crosses into
JavaScript, it does so plainly.

## Why XML Now

XML is not just angle brackets. XML is a contract:

- elements have names;
- attributes have names;
- nesting is explicit;
- documents are parseable before execution;
- namespaces let languages grow without guessing;
- source can be transformed without pretending it is text.

That matters in the age of AI because agents are better collaborators when the
program has visible grammar. A model can add a chapter, inspect a component,
trace a signal, or rewrite a command without guessing which string is code,
which string is markup, and which string is data.

```xml
<repeat ref="/todos/todo" as="todo">
  <button on:click="deleteNode($todo)">Delete</button>
  <text value="$todo/@text" />
</repeat>
```

The data path is visible. The local variable is visible. The event boundary is
visible. This is what strong markup buys back.

## What Galath Includes

- Custom elements from `<component>`.
- Reactive `<signal>` values.
- Derived `<computed>` values.
- XML instance trees with path selection.
- Interpolation with `{expr}`.
- Two-way bindings with `bind:value` and `bind:checked`.
- Event handlers with `on:*`.
- Named controller actions.
- Command sets.
- Reusable data templates.
- XML imports.
- Attached behaviors.
- Lifecycle hooks with `<on:mount>` and `<on:unmount>`.
- DOM morphing to preserve focus and form state.

## Run The Playground

```sh
npm run serve
```

Then open the served URL. The playground is the main documentation surface and
is itself written in Galath.

No build step is required for the playground. The browser loads local modules
through an import map.

## Minimal Boot

```html
<div id="mount"></div>

<script type="application/xml" id="galath-source">
  <galath version="1.0">
    <component name="hello" tag="x-hello">
      <model>
        <signal name="name" value="World" />
      </model>
      <view>
        <h1>Hello, {name}.</h1>
      </view>
    </component>

    <application name="app">
      <x-hello />
    </application>
  </galath>
</script>

<script type="module">
  import { boot } from 'galath/boot';

  await boot({
    source: document.getElementById('galath-source').textContent,
    mount: document.getElementById('mount'),
  });
</script>
```

## The Strong Core Contract

Galath should remain small enough to understand and structured enough to grow.

It should be possible to answer these questions by reading the document:

- What state exists?
- What data tree exists?
- What renders?
- What changes state?
- What paths are read or written?
- What components are imported?
- What behavior is named?

If a language can answer those questions directly, AI tools can help without
turning the codebase into mud.

## Not A Framework Fashion

Galath is not trying to hide the platform. It uses the platform:

- Custom Elements for component boundaries.
- DOMParser and XMLSerializer for documents.
- `fetch()` for imports.
- native events for interaction.
- import maps for local modules.

The language is a thin, explicit layer over the browser. Its job is to preserve
the structure that ordinary web code too often throws away.

## The Manifesto

We choose documents over blobs.

We choose named state over ambient mutation.

We choose paths over guesswork.

We choose explicit imports over invisible build magic.

We choose small runtimes over dependency gravity.

We choose a language an AI can inspect without hallucinating the shape of the
program.

We choose XML not because it is old, but because it is still one of the few
formats honest enough to say what a program is made of.

That is Galath Strong Core.
