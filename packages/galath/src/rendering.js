// =============================================================================
// rendering.js
//
// The view -> HTML compiler and DOM wiring layer.
//
// This is the single biggest feature, so it's worth understanding its three
// phases before reading the code:
//
//   PHASE 1: render to HTML string + binding records
//
//     We walk the `<view>` subtree and produce an HTML string. Whenever we
//     encounter a directive that needs *runtime* logic (e.g. an event
//     handler, a two-way bind, an attached behavior), we record a small
//     `binding` object describing what should happen and stamp the element
//     with `data-xes-id="...."` so we can find it after the morph.
//
//   PHASE 2: morph the live DOM
//
//     The component's `renderNow()` (in component.js) parses our string,
//     then calls `morph` to update the live DOM in place. This preserves
//     focus, value, scroll, etc.
//
//   PHASE 3: install bindings on live elements
//
//     Once the DOM is fresh, we walk the `bindings` array, look up each
//     element by its `data-xes-id`, and attach event listeners, two-way
//     binds, behaviors, and drag/drop. Every listener is collected by the
//     instance's `renderScope`, which is disposed at the start of the next
//     render pass - no listener leaks.
//
// Special tags handled directly (NOT emitted as plain HTML):
//
//   <repeat ref="path" as="x">..</repeat>     - iterate over selected nodes
//   <items source="path" template="name" />    - iterate using a datatemplate
//   <if test="expr">..[<else>..</else>]</if>  - conditional with optional else
//   <text value="path|expr" />                - escaped text output
//
// Special directives parsed off ANY element:
//
//   on:click="expr | #actionName"             - event listener
//   bind:property="path|signal"                - two-way bind
//   use:behavior="value"                       - install attached behavior
//   drag:source="payload"                      - mark draggable
//   drop:target="payload"                      - mark drop zone
//   drop:command="cmd"                         - command run on drop
//   class:foo="expr"                           - toggle class `foo`
//   command="cmd"                              - bind a button to a command
//   disabled="{expr}"                          - conditional disabled
//   class="..."                                - regular interpolated class
//   anything-else="..."                        - interpolated attribute
// =============================================================================

export function renderingFeature(language) {
  // HTML void tags - we self-close these with `<tag ...>` and never emit a
  // closing tag. The off-screen template would tolerate either, but the
  // morph compares text length and we want predictable output.
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'source', 'track', 'wbr',
  ]);

  // Tags that the renderer should *display* as their serialized XML rather
  // than recurse into. They are "control plane" tags - if you accidentally
  // write `<commandset>` inside `<view>`, you get a code box, not silent
  // misbehavior.
  const controlTags = new Set([
    'xes', 'galath', 'component', 'application', 'model', 'instance',
    'data', 'view', 'commandset', 'controller', 'listeners', 'datatemplate',
    'on:mount', 'on:unmount', 'style', 'computed', 'map', 'import',
  ]);

  // ---------------------------------------------------------------------------
  // Public: render a list of nodes
  // ---------------------------------------------------------------------------
  language.renderChildren = (nodes, instance, local, bindings) =>
    nodes.map(node => renderNode(node, instance, local, bindings)).join('');

  // Dispatch one node to the right renderer.
  function renderNode(node, instance, local, bindings) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip pure whitespace text - leaves in HTML are noisy. Non-empty
      // text is interpolated and HTML-escaped.
      return node.textContent.trim()
        ? language.interpolate(node.textContent, instance, local)
        : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    if (node.localName === 'repeat') return renderRepeat(node, instance, local, bindings);
    if (node.localName === 'items') return renderItems(node, instance, local, bindings);
    if (node.localName === 'if') return renderIf(node, instance, local, bindings);
    if (node.localName === 'switch') return renderSwitch(node, instance, local, bindings);
    if (node.localName === 'slot') return renderSlot(node, instance, local, bindings);
    if (node.localName === 'text') {
      // <text value="path|expr" /> - resolve and HTML-escape.
      return language.escapeHtml(
        language.valueOf(node.getAttribute('value') || '', instance, local),
      );
    }
    return renderElement(node, instance, local, bindings);
  }

  // ---------------------------------------------------------------------------
  // <repeat>: low-level loop over a node-set
  //
  // Optional `key="@id"` (or any expression) makes the renderer stamp the
  // first emitted element of each iteration with `data-xes-key="..."`. The
  // morph layer detects fully keyed siblings and reorders by key instead of
  // by position - so reorders preserve focus / scroll / state inside rows.
  // ---------------------------------------------------------------------------
  function renderRepeat(node, instance, local, bindings) {
    const ref =
      node.getAttribute('ref') ||
      node.getAttribute('nodeset') ||
      node.getAttribute('each');
    const as = node.getAttribute('as') || 'item';
    const keyExpr = node.getAttribute('key');
    const items = instance.tree?.select(ref, local) ?? [];
    return items
      .map((item, index) => {
        const childLocal = { ...local, [as]: item, [`$${as}`]: item, index };
        const html = language.renderChildren(
          [...node.childNodes],
          instance,
          childLocal,
          bindings,
        );
        if (!keyExpr) return html;
        const key = String(language.evaluate(keyExpr, instance, childLocal, '') ?? '');
        return injectKeyAttribute(html, key);
      })
      .join('');
  }

  // ---------------------------------------------------------------------------
  // <items>: high-level loop using a datatemplate
  // Same `key` semantics as <repeat>; honored on either the <items> tag or
  // its <datatemplate> definition.
  // ---------------------------------------------------------------------------
  function renderItems(node, instance, local, bindings) {
    const template = instance.templates.get(node.getAttribute('template'));
    if (!template) {
      console.warn(
        `[galath] no <datatemplate name="${node.getAttribute('template')}"> found`,
      );
      return '';
    }
    const as = node.getAttribute('as') || template.getAttribute('for') || 'item';
    const keyExpr = node.getAttribute('key') || template.getAttribute('key');
    const items = instance.tree?.select(node.getAttribute('source'), local) ?? [];
    return items
      .map((item, index) => {
        const childLocal = { ...local, [as]: item, [`$${as}`]: item, index };
        const html = language.renderChildren(
          [...template.childNodes],
          instance,
          childLocal,
          bindings,
        );
        if (!keyExpr) return html;
        const key = String(language.evaluate(keyExpr, instance, childLocal, '') ?? '');
        return injectKeyAttribute(html, key);
      })
      .join('');
  }

  // Stamp `data-xes-key="..."` onto the first element opening tag in `html`.
  // Leaves leading whitespace and any leading text alone. This is purely a
  // string rewrite because the rendering pipeline emits HTML strings.
  function injectKeyAttribute(html, key) {
    const safe = String(key).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return html.replace(
      /(<\s*[a-zA-Z][\w:-]*)/,
      (m) => `${m} data-xes-key="${safe}"`,
    );
  }

  // ---------------------------------------------------------------------------
  // <if test="..."> ...optional <else>... </if>
  // ---------------------------------------------------------------------------
  function renderIf(node, instance, local, bindings) {
    const test = language.evaluate(node.getAttribute('test') || 'false', instance, local);
    // Children that are NOT <else> are rendered when test is truthy. The
    // (single) <else> child is rendered when test is falsy. Multiple
    // <else>s render in order, in case authors really want that.
    const elseChildren = [...node.children].filter(c => c.localName === 'else');
    const thenChildren = [...node.childNodes].filter(
      n => !(n.nodeType === Node.ELEMENT_NODE && n.localName === 'else'),
    );
    if (test) return language.renderChildren(thenChildren, instance, local, bindings);
    return elseChildren
      .flatMap(el => [...el.childNodes])
      .map(n => renderNode(n, instance, local, bindings))
      .join('');
  }

  // ---------------------------------------------------------------------------
  // <switch on="expr">
  //   <case value="basic">...</case>   value is a plain string, compared literally
  //   <case test="expr">...</case>     test is a full expression (boolean)
  //   <default>...</default>
  // </switch>
  //
  // Picks the first matching <case> and renders its children. Falls back to
  // <default> when nothing matches. Cleaner than chaining <if>s.
  // ---------------------------------------------------------------------------
  function renderSwitch(node, instance, local, bindings) {
    const onAttr = node.getAttribute('on');
    const subject = onAttr != null
      ? language.evaluate(onAttr, instance, local)
      : undefined;
    const cases = [...node.children].filter(c => c.localName === 'case');
    for (const c of cases) {
      let match = false;
      if (c.hasAttribute('value')) {
        const candidate = c.getAttribute('value');
        match = String(subject) === candidate;
      } else if (c.hasAttribute('test')) {
        match = Boolean(language.evaluate(c.getAttribute('test'), instance, local));
      }
      if (match) return language.renderChildren([...c.childNodes], instance, local, bindings);
    }
    const fallback = [...node.children].find(c => c.localName === 'default');
    if (fallback) return language.renderChildren([...fallback.childNodes], instance, local, bindings);
    return '';
  }

  // ---------------------------------------------------------------------------
  // <slot />: insert children that the host wrote between <my-tag>...</my-tag>.
  //
  // The children were captured in connectedCallback before our xesRoot was
  // attached, and live on `instance.slotNodes`. We render a marker the install
  // phase will replace with the captured DOM. The marker carries
  // `data-xes-frozen` so subsequent morphs leave it alone (see morph.js).
  //
  // If the host provided no slot content, we render the <slot>'s own children
  // as a default (familiar from web-components / Vue / Svelte).
  // ---------------------------------------------------------------------------
  function renderSlot(node, instance, local, bindings) {
    const hasSlotContent = (instance.slotNodes?.length ?? 0) > 0;
    if (!hasSlotContent) {
      return language.renderChildren([...node.childNodes], instance, local, bindings);
    }
    const id = `s${bindings.length.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    bindings.push({
      id,
      slot: true,
      events: [],
      binds: [],
      behaviors: [],
      drag: null,
      drop: null,
      dropCommand: null,
      command: null,
      local,
    });
    // The wrapper inherits any tag the author chose ("slot" by default), so
    // styling/layout still works. `data-xes-frozen` keeps morph out of its
    // children once we install slot DOM in there.
    return `<slot data-xes-id="${id}" data-xes-slot="1"></slot>`;
  }

  // ---------------------------------------------------------------------------
  // Generic element rendering. Walks attributes, parses framework
  // directives, and emits HTML.
  // ---------------------------------------------------------------------------
  function renderElement(node, instance, local, bindings) {
    if (controlTags.has(node.localName)) {
      // The author wrote a control-plane tag inside the view. Show its
      // serialization instead of pretending it works.
      return `<pre class="xes-code rounded p-3"><code>${language.escapeHtml(language.serialize(node))}</code></pre>`;
    }

    // Stable id used to find this element after the morph.
    const id = `x${bindings.length.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const binding = {
      id,
      events: [],
      binds: [],
      behaviors: [],
      drag: null,
      drop: null,
      dropCommand: null,
      command: null,
      local,
    };
    const attrs = [`data-xes-id="${id}"`];
    // Class is special: `class="..."` and `class:foo="expr"` may both
    // appear in any order. We accumulate every class fragment here and
    // emit a single `class="..."` at the end so we never produce two
    // class attributes (which would be invalid HTML).
    const classParts = [];

    for (const attr of [...node.attributes]) {
      const name = attr.name;
      const value = attr.value;

      // -- on:event="code|#action" ----------------------------------------
      if (name.startsWith('on:')) {
        binding.events.push({ event: name.slice(3), code: value });
        continue;
      }

      // -- bind:prop="signalName|path" ------------------------------------
      if (name.startsWith('bind:')) {
        const property = name.slice(5);
        binding.binds.push({ property, target: value });
        const current = readBindingValue(value, instance, local);
        if (property === 'checked') {
          // Booleans render as a presence-only HTML attribute.
          if (Boolean(current)) attrs.push('checked');
        } else {
          attrs.push(`${property}="${language.escapeHtml(current)}"`);
        }
        continue;
      }

      // -- use:behavior="value" -------------------------------------------
      if (name.startsWith('use:')) {
        binding.behaviors.push({ name: name.slice(4), value });
        continue;
      }

      // -- drag:* / drop:* ------------------------------------------------
      // We collect them on the binding record so installBindings can hook
      // them up against the live element.
      if (name.startsWith('drag:')) {
        binding.drag = { kind: name.slice(5), value };
        continue;
      }
      if (name.startsWith('drop:')) {
        const which = name.slice(5);
        if (which === 'command') binding.dropCommand = value;
        else binding.drop = { kind: which, value };
        continue;
      }

      // -- class:foo="expr" -----------------------------------------------
      if (name.startsWith('class:')) {
        if (language.evaluate(value, instance, local)) classParts.push(name.slice(6));
        continue;
      }

      // -- command="..." --------------------------------------------------
      if (name === 'command') {
        binding.command = value;
        if (!language.commandEnabled(instance, value, local)) attrs.push('disabled');
        attrs.push(`data-command="${language.escapeHtml(value)}"`);
        continue;
      }

      // -- disabled="{expr}" ----------------------------------------------
      if (name === 'disabled' && value.startsWith('{') && value.endsWith('}')) {
        if (language.evaluate(value.slice(1, -1), instance, local)) attrs.push('disabled');
        continue;
      }

      // -- class="..." (interpolated; merged with class:* below) ----------
      if (name === 'class') {
        classParts.unshift(language.interpolate(value, instance, local));
        continue;
      }

      // -- everything else: interpolate ------------------------------------
      attrs.push(`${name}="${language.interpolate(value, instance, local)}"`);
    }

    // Single class attribute, regardless of source ordering.
    if (classParts.length) {
      const merged = classParts.filter(Boolean).join(' ').trim();
      if (merged) attrs.push(`class="${merged}"`);
    }

    bindings.push(binding);

    const children = language.renderChildren([...node.childNodes], instance, local, bindings);
    if (voidTags.has(node.localName)) return `<${node.localName} ${attrs.join(' ')}>`;
    return `<${node.localName} ${attrs.join(' ')}>${children}</${node.localName}>`;
  }

  // ---------------------------------------------------------------------------
  // Reading and writing the value behind a `bind:`. `/path/@attr` and `$x`
  // hit the instance tree; bare names hit the signal map.
  // ---------------------------------------------------------------------------
  function readBindingValue(target, instance, local) {
    if (target.startsWith('/') || target.startsWith('$')) {
      return instance.tree?.valueOf(target, local) ?? '';
    }
    const sig = instance.scope.signal(target);
    if (sig) {
      // Two-way binds re-render when the underlying signal moves; record
      // the read so the per-render subscription pass can pick it up.
      instance.readSignals?.add(target);
      return sig.value;
    }
    return '';
  }

  function writeBindingValue(target, value, instance, local) {
    if (target.startsWith('/') || target.startsWith('$')) {
      instance.tree?.setValue(target, value, local);
    } else {
      const sig = instance.scope.signal(target);
      if (sig) sig.value = value;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 3: install all bindings on the freshly morphed DOM.
  //
  // Every listener registered here is collected by the instance's
  // renderScope. The next render pass disposes that scope, which
  // automatically detaches all listeners. No leaks.
  // ---------------------------------------------------------------------------
  language.installBindings = (instance, bindings) => {
    for (const binding of bindings) {
      const element = instance.xesRoot?.querySelector(`[data-xes-id="${binding.id}"]`);
      if (!element) continue;

      // <slot> markers: move (don't clone) captured slot nodes into the
      // wrapper, then freeze it so morph won't touch the children. Idempotent
      // - if already frozen and populated, we do nothing.
      if (binding.slot) {
        if (!element.hasAttribute('data-xes-frozen')) {
          for (const slotNode of instance.slotNodes ?? []) {
            if (slotNode.parentNode) slotNode.parentNode.removeChild(slotNode);
            element.appendChild(slotNode);
          }
          element.setAttribute('data-xes-frozen', '1');
        }
        continue;
      }

      // Buttons / menu items wired to a named command.
      if (binding.command) {
        const handler = event =>
          language.executeCommand(instance, binding.command, binding.local, event);
        element.addEventListener('click', handler);
        instance.renderScope.collect(() =>
          element.removeEventListener('click', handler),
        );
      }

      // on:event="code|#action"
      for (const eventBinding of binding.events) {
        const handler = event =>
          eventBinding.code.startsWith('#')
            ? language.executeAction(
                instance,
                eventBinding.code.slice(1),
                binding.local,
                event,
              )
            : language.run(eventBinding.code, instance, binding.local, event);
        element.addEventListener(eventBinding.event, handler);
        instance.renderScope.collect(() =>
          element.removeEventListener(eventBinding.event, handler),
        );
      }

      // bind:property="path|signal"
      for (const bind of binding.binds) {
        // Pick a sensible event for each property: form fields use
        // `input`/`change`, others use `change` as a safe default.
        const eventName = bind.property === 'checked' ? 'change' : 'input';
        const handler = () =>
          writeBindingValue(
            bind.target,
            readElementBindingValue(element, bind.property),
            instance,
            binding.local,
          );
        element.addEventListener(eventName, handler);
        instance.renderScope.collect(() =>
          element.removeEventListener(eventName, handler),
        );
      }

      // use:* attached behaviors.
      for (const behavior of binding.behaviors) {
        language.installBehavior(
          behavior.name,
          element,
          behavior.value,
          instance,
          binding.local,
        );
      }

      // Drag/drop: only meaningful when one of the four pieces is present.
      if (binding.drag) {
        instance.renderScope.collect(
          language.installDragDrop(
            element,
            'source',
            binding.drag.value,
            instance,
            binding.local,
            null,
          ),
        );
      }
      if (binding.drop || binding.dropCommand) {
        instance.renderScope.collect(
          language.installDragDrop(
            element,
            'target',
            binding.drop?.value ?? '',
            instance,
            binding.local,
            binding.dropCommand,
          ),
        );
      }
    }
  };

  function readElementBindingValue(element, property) {
    if (property === 'checked') return element.checked;
    if (property === 'value' && isNumericInput(element)) {
      return element.value === '' ? '' : element.valueAsNumber;
    }
    return element[property];
  }

  function isNumericInput(element) {
    const type = String(element.getAttribute?.('type') || element.type || '').toLowerCase();
    return element.localName === 'input' && (type === 'number' || type === 'range');
  }

  // ---------------------------------------------------------------------------
  // Self-tests
  // ---------------------------------------------------------------------------
  language.test('rendering: <text> escapes embedded markup', () => {
    const fake = { scope: new language.Concern('fake'), tree: null };
    fake.scope.signal('snippet', new language.Signal('<x-live></x-live>'));
    const xml = new DOMParser().parseFromString('<text value="snippet"/>', 'application/xml').documentElement;
    const html = language.renderChildren([xml], fake, {}, []);
    if (!html.includes('&lt;x-live&gt;')) {
      throw new Error('snippet was rendered as live markup');
    }
  });

  language.test('rendering: number inputs bind numeric values', () => {
    const fake = { scope: new language.Concern('fake'), tree: null };
    fake.scope.signal('step', new language.Signal(1));
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '10';
    writeBindingValue('step', readElementBindingValue(input, 'value'), fake, {});
    if (fake.scope.signal('step').value !== 10) {
      throw new Error('number input value was not written as a number');
    }
  });
}
