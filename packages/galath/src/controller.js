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

      // <fetch url="..." into="signalName" as="json|text"> - asynchronous
      // HTTP load. The result is written to the named signal when the
      // response resolves. We also flip an optional `loading` signal and
      // an `error` signal so the view can render spinners / error states
      // without writing JS. Operations after <fetch> in the same block
      // run immediately - this is fire-and-forget.
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
        const loadingSig = op.getAttribute('loading');
        const errorSig = op.getAttribute('error');
        const setSig = (name, value) => {
          if (!name) return;
          const sig = instance.scope.signal(name);
          if (sig) sig.value = value;
        };
        setSig(loadingSig, true);
        setSig(errorSig, '');
        fetch(url)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return as === 'text' ? response.text() : response.json();
          })
          .then(data => setSig(into, data))
          .catch(err => setSig(errorSig, String(err?.message || err)))
          .finally(() => setSig(loadingSig, false));
        continue;
      }
    }
  };
}
