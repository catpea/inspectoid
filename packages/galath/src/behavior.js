// =============================================================================
// behavior.js
//
// Attached behaviors. Inspired by XAML Attached Properties and Svelte
// `use:` actions, these let an attribute on an element install a small,
// disposable extension on it - without changing the element's tag or
// owning component.
//
// Built-in behaviors:
//
//   use:copy="signalNameOrPath"
//     On click, copy the resolved string value to the clipboard. Adds a
//     transient `btn-success` class for visual feedback.
//
//   use:focus="expr"
//     Focus the element when `expr` is truthy. Re-evaluated each render.
//
//   use:autosize
//     Auto-grow a textarea as the user types.
//
//   drag:source="$todo"
//     Mark the element draggable and remember the resolved value as the
//     current drag payload.
//
//   drop:target="$todo"
//     Make the element a drop zone. On drop, runs the optional
//     `drop:command="cmdName"` with `$source`/`$target` in the local scope.
//
// You can register your own with `language.behaviors.set('name', fn)` from a
// downstream feature - the API is small on purpose.
//
// All behaviors return a Disposable so the renderer can clean them up when
// the element is removed or re-rendered.
// =============================================================================

// Module-private register of the *currently dragging* payload. We store the
// resolved value here when a dragstart fires; the matching drop reads it.
// Browsers have a richer DataTransfer API but it stringifies payloads -
// XNodes don't survive that, so we keep them in JS memory and use a shared
// session id across dataTransfer to validate.
let activeDragPayload = null;
let activeDragId = null;

export function behaviorFeature(language) {
  // ---------------------------------------------------------------------------
  // copy: click-to-clipboard
  // ---------------------------------------------------------------------------
  language.behaviors.set('copy', (element, value, instance) => {
    const handler = async () => {
      // Resolution order: explicit signal name -> path -> literal value.
      const text =
        instance.scope.signal(value)?.value ??
        language.valueOf(value, instance) ??
        value;
      try {
        await navigator.clipboard?.writeText(String(text));
        element.classList.add('btn-success');
        setTimeout(() => element.classList.remove('btn-success'), 600);
      } catch {
        // Clipboard may be denied (e.g. insecure context). Print so the
        // user can still copy by hand.
        console.info('[galath] copy behavior value:', text);
      }
    };
    element.addEventListener('click', handler);
    return new language.Disposable(() => element.removeEventListener('click', handler));
  });

  // ---------------------------------------------------------------------------
  // focus: imperative focus when truthy
  // ---------------------------------------------------------------------------
  language.behaviors.set('focus', (element, value, instance, local) => {
    // Evaluate immediately. Most renderers re-mount this on each render
    // pass, so reactive focusing works without subscribing to specific
    // signals here.
    if (language.evaluate(value, instance, local)) {
      // Defer to a microtask so the element is in the live DOM after morph.
      queueMicrotask(() => element.focus?.());
    }
    return new language.Disposable(() => {});
  });

  // ---------------------------------------------------------------------------
  // autosize: grow textarea height to fit content
  // ---------------------------------------------------------------------------
  language.behaviors.set('autosize', element => {
    const grow = () => {
      element.style.height = 'auto';
      element.style.height = element.scrollHeight + 'px';
    };
    element.addEventListener('input', grow);
    queueMicrotask(grow);
    return new language.Disposable(() => element.removeEventListener('input', grow));
  });

  // ---------------------------------------------------------------------------
  // Drag and drop are a pair. Source resolves a payload at dragstart time.
  // Target intercepts dragover/drop and dispatches the configured command,
  // which receives `$source` and `$target` as locals (and any other locals
  // from the surrounding scope).
  // ---------------------------------------------------------------------------
  language.installDragDrop = (element, kind, value, instance, local, command) => {
    if (kind === 'source') {
      element.setAttribute('draggable', 'true');
      const onStart = e => {
        // Resolve the payload at drag start - its identity is "now", not
        // when the binding was set up.
        activeDragPayload = resolvePayload(value, instance, local);
        activeDragId = String(Date.now() + Math.random());
        e.dataTransfer.setData('text/plain', activeDragId);
        e.dataTransfer.effectAllowed = 'move';
        element.classList.add('xes-dragging');
      };
      const onEnd = () => {
        element.classList.remove('xes-dragging');
        activeDragPayload = null;
        activeDragId = null;
      };
      element.addEventListener('dragstart', onStart);
      element.addEventListener('dragend', onEnd);
      return new language.Disposable(() => {
        element.removeEventListener('dragstart', onStart);
        element.removeEventListener('dragend', onEnd);
      });
    }

    if (kind === 'target') {
      const onOver = e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        element.classList.add('xes-drop-hint');
      };
      const onLeave = () => element.classList.remove('xes-drop-hint');
      const onDrop = e => {
        e.preventDefault();
        element.classList.remove('xes-drop-hint');
        // Validate the drag came from our session. Cross-tab drags would
        // not have a matching activeDragId.
        const id = e.dataTransfer.getData('text/plain');
        if (id !== activeDragId || activeDragPayload == null) return;
        const targetPayload = resolvePayload(value, instance, local);
        // No-op when dropping a node onto itself.
        if (activeDragPayload === targetPayload) return;
        if (command) {
          // Inject `$source` / `$target` into the local scope so the
          // command body can reference them with `$source` / `$target`.
          const childLocal = {
            ...local,
            $source: activeDragPayload,
            $target: targetPayload,
            source: activeDragPayload,
            target: targetPayload,
          };
          language.executeCommand(instance, command, childLocal, e);
        }
      };
      element.addEventListener('dragover', onOver);
      element.addEventListener('dragleave', onLeave);
      element.addEventListener('drop', onDrop);
      return new language.Disposable(() => {
        element.removeEventListener('dragover', onOver);
        element.removeEventListener('dragleave', onLeave);
        element.removeEventListener('drop', onDrop);
      });
    }
  };

  /**
   * The renderer calls this to install a `use:NAME` behavior on an element.
   * Behaviors return a Disposable; we stash it on the active render scope
   * so the next render pass cleans it up automatically.
   */
  language.installBehavior = (name, element, value, instance, local) => {
    const fn = language.behaviors.get(name);
    if (!fn) {
      console.warn(`[galath] no behavior named "use:${name}"`);
      return;
    }
    instance.renderScope.collect(fn(element, value, instance, local));
  };

  // Resolve a behavior value to its underlying object. Path-likes
  // (`$todo`, `/foo/bar`) yield the actual XNode; plain names yield a
  // signal value; anything else is returned literally.
  function resolvePayload(expr, instance, local) {
    expr = String(expr ?? '').trim();
    if (expr.startsWith('$') || expr.startsWith('/')) {
      return instance.tree?.select(expr, local)[0] ?? null;
    }
    if (instance.scope.signal(expr)) return instance.scope.signal(expr).value;
    return expr;
  }
}
