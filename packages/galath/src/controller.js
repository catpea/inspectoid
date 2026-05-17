// =============================================================================
// controller.js
//
// FXML-style controller actions and the operation interpreter.
//
// A `<controller>` is a sibling of `<view>` that contains `<action>`s. Views
// invoke them by name via `on:click="#actionName"` or
// `<listener handler="#actionName">`. Keeping behavior in named actions
// makes it easy to:
//
//   * Read the view as pure structure - no inline business logic.
//   * Reuse the same action from multiple events / commands.
//   * Test the action logic separately (it just runs operations).
//
// Operations supported here (also used by `<command>`):
//
//   <set signal="x" value="expr" />        - update a signal
//   <setvalue ref="/foo/@bar" value="..." /> - update an instance attribute
//   <insert ref="/parent">                  - append child(ren) into a node
//     <child .../>                          - the children to insert
//   </insert>
//   <delete ref="/foo/bar[@id=...]" />     - remove matching nodes
//   <eval>...js...</eval>                  - escape hatch (last resort)
//   <log value="expr" />                    - debug print to console
//
// Adding a new operation? Drop it in `runOperations` and document it in the
// playground "Controller" chapter.
// =============================================================================

export function controllerFeature(language) {
  /**
   * Index a component's controller actions by name during connect.
   */
  language.setupController = instance => {
    instance.actions = new Map();
    const controller = language.firstChildElement(instance.definition, 'controller');
    if (!controller) return;
    for (const action of language.childElements(controller, 'action')) {
      instance.actions.set(action.getAttribute('name'), action);
    }
  };

  /**
   * Invoke a controller action by name. Quietly no-ops if the action does
   * not exist - the view is already broken at that point and we'd rather
   * the user see a console warning than a runtime crash.
   */
  language.executeAction = (instance, name, local = {}, event = null) => {
    const action = instance.actions?.get(name);
    if (!action) {
      console.warn(`[galath] no controller action named "${name}"`);
      return;
    }
    language.runOperations([...action.children], instance, local, event);
  };

  /**
   * Walk a list of operation elements and apply each one. Operations are
   * all synchronous - if you need async work, do it in an `<eval>` op or
   * in JS that updates a signal.
   */
  language.runOperations = (ops, instance, local = {}, event = null) => {
    for (const op of ops) {
      if (op.nodeType !== Node.ELEMENT_NODE) continue;

      // <set signal="x" value="expr" />
      if (op.localName === 'set') {
        const sig = instance.scope.signal(op.getAttribute('signal'));
        if (sig) {
          sig.value = language.evaluate(
            op.getAttribute('value') ?? op.textContent.trim(),
            instance,
            local,
            sig.value,
            event,
          );
        }
        continue;
      }

      // <setvalue ref="/path/@attr" value="expr" />
      if (op.localName === 'setvalue') {
        instance.tree?.setValue(
          op.getAttribute('ref'),
          language.evaluate(
            op.getAttribute('value') ?? op.textContent.trim(),
            instance,
            local,
            '',
            event,
          ),
          local,
        );
        continue;
      }

      // <insert ref="/parent">child elements</insert>
      if (op.localName === 'insert') {
        const parent = instance.tree?.select(op.getAttribute('ref'), local)[0];
        if (!parent) continue;
        for (const childElement of [...op.children]) {
          parent.append(language.parseDataElement(childElement, instance, local));
        }
        continue;
      }

      // <delete ref="/path[@predicate]" />
      if (op.localName === 'delete') {
        const targets = [
          ...(instance.tree?.select(op.getAttribute('ref'), local) ?? []),
        ];
        for (const target of targets) target.remove();
        continue;
      }

      // <log value="expr" /> - debug helper, prints to console.
      if (op.localName === 'log') {
        const value = language.evaluate(
          op.getAttribute('value') ?? op.textContent.trim(),
          instance,
          local,
          '',
          event,
        );
        console.info('[galath log]', value);
        continue;
      }

      // <call action="name" /> - call another action (handy for shared
      // behavior between commands and event handlers).
      if (op.localName === 'call') {
        const name = op.getAttribute('action');
        if (name) language.executeAction(instance, name, local, event);
        continue;
      }

      // <eval>...</eval> - last resort. Use sparingly; keep app code in
      // actions and signals.
      if (op.localName === 'eval') {
        language.run(op.textContent, instance, local, event);
        continue;
      }

      // <store signal="name" key="storageKey" /> - persist a signal to localStorage.
      // <restore signal="name" key="storageKey" default="value" /> - read it back.
      // Use <restore> in <on:mount> to rehydrate on page load; pair with a
      // signal-change <listener> that calls <store> to keep it in sync.
      if (op.localName === 'store') {
        const sig = instance.scope.signal(op.getAttribute('signal'));
        const key = language.evaluate(op.getAttribute('key') ?? '', instance, local, '', event);
        if (sig && key) {
          try { localStorage.setItem(key, JSON.stringify(sig.value)); } catch { /* quota or private-mode */ }
        }
        continue;
      }

      if (op.localName === 'restore') {
        const sig = instance.scope.signal(op.getAttribute('signal'));
        const key = language.evaluate(op.getAttribute('key') ?? '', instance, local, '', event);
        if (sig && key) {
          try {
            const raw = localStorage.getItem(key);
            if (raw != null) {
              sig.value = JSON.parse(raw);
            } else if (op.hasAttribute('default')) {
              sig.value = language.evaluate(op.getAttribute('default'), instance, local, sig.value, event);
            }
          } catch {
            if (op.hasAttribute('default')) {
              sig.value = language.evaluate(op.getAttribute('default'), instance, local, sig.value, event);
            }
          }
        }
        continue;
      }

      // <fetch url="..." into="signalName" as="json|text"
      //        method="POST" body="expr" headers="expr" loading="sig"
      //        error="sig"> - asynchronous HTTP load.
      //
      //   url       - evaluated expression yielding the absolute or relative URL
      //   method    - HTTP method, default GET (literal string, not evaluated)
      //   body      - evaluated expression; objects are JSON-encoded, strings
      //               pass through, FormData/Blob/etc are sent as-is
      //   headers   - evaluated expression; should yield a plain object whose
      //               keys/values are added to the request (auto-injects
      //               Content-Type: application/json when body is an object)
      //   into      - signal to receive the response value
      //   as        - parse mode: json (default), text, or response (raw)
      //   loading   - signal toggled true while in-flight
      //   error     - signal set to an error message when the request fails
      //
      // The op is fire-and-forget: operations after <fetch> in the same
      // block run synchronously, before the response resolves.
      if (op.localName === 'fetch') {
        const url = language.evaluate(
          op.getAttribute('url') ?? "''",
          instance,
          local,
          '',
          event,
        );
        const into = op.getAttribute('into');
        const as = (op.getAttribute('as') || 'json').toLowerCase();
        const method = (op.getAttribute('method') || 'GET').toUpperCase();
        const loadingSig = op.getAttribute('loading');
        const errorSig = op.getAttribute('error');
        const setSig = (name, value) => {
          if (!name) return;
          const sig = instance.scope.signal(name);
          if (sig) sig.value = value;
        };

        const init = { method };
        const headersAttr = op.getAttribute('headers');
        const headers = headersAttr
          ? language.evaluate(headersAttr, instance, local, {}, event)
          : {};
        if (op.hasAttribute('body')) {
          const raw = language.evaluate(op.getAttribute('body'), instance, local, null, event);
          if (raw == null) {
            // null body -> send nothing
          } else if (
            typeof raw === 'string' ||
            raw instanceof FormData ||
            raw instanceof Blob ||
            raw instanceof ArrayBuffer ||
            (typeof URLSearchParams !== 'undefined' && raw instanceof URLSearchParams)
          ) {
            init.body = raw;
          } else {
            init.body = JSON.stringify(raw);
            if (!('content-type' in lowerKeyed(headers))) {
              headers['Content-Type'] = 'application/json';
            }
          }
        }
        if (Object.keys(headers).length) init.headers = headers;

        setSig(loadingSig, true);
        setSig(errorSig, '');
        fetch(url, init)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (as === 'response') return response;
            return as === 'text' ? response.text() : response.json();
          })
          .then(data => setSig(into, data))
          .catch(err => setSig(errorSig, String(err?.message || err)))
          .finally(() => setSig(loadingSig, false));
        continue;
      }

      // <emit name="my-event" detail="expr" bubbles="true|false"
      //       composed="true|false" /> - dispatch a CustomEvent on the
      // component host element. Parents listen with on:my-event="..."
      // and read $event.detail in the handler. This is the standard
      // child-to-parent signaling pattern for Custom Elements.
      if (op.localName === 'emit') {
        const name = op.getAttribute('name');
        if (!name) continue;
        const detail = op.hasAttribute('detail')
          ? language.evaluate(op.getAttribute('detail'), instance, local, null, event)
          : null;
        const bubbles = op.getAttribute('bubbles') !== 'false';
        const composed = op.getAttribute('composed') === 'true';
        try {
          instance.dispatchEvent(new CustomEvent(name, { detail, bubbles, composed }));
        } catch (error) {
          console.warn('[galath] <emit> failed:', name, error);
        }
        continue;
      }
    }
  };

  // Helper for case-insensitive header lookup. The fetch op auto-injects
  // Content-Type only when the user has not already provided one.
  function lowerKeyed(obj) {
    const out = {};
    for (const k of Object.keys(obj || {})) out[String(k).toLowerCase()] = obj[k];
    return out;
  }
}
