// =============================================================================
// xml-events.js
//
// XML Events - declarative listeners for *data-tree* mutations, separate
// from DOM events. Lets controllers observe when nodes are inserted,
// deleted, or their attributes change without sprinkling JS through the
// view.
//
// Syntax:
//
//   <listeners>
//     <listener event="xforms-insert"
//               observer="/todos"
//               handler="#onTodoInserted" />
//     <listener event="*">                       <!-- any event -->
//       <set signal="lastChange" value="$event.type" />
//     </listener>
//   </listeners>
//
//   - `event`    one of `xforms-insert`, `xforms-delete`,
//                `xforms-value-changed`, or `*` for all.
//   - `observer` optional path filter; the listener fires only when the
//                event path starts with this prefix.
//   - `handler`  optional `#actionName` to call. When omitted, the
//                listener's child operations run inline (handy for one-line
//                listeners).
//
// All listener subscriptions are collected by the component's own scope so
// they tear down on disconnect.
// =============================================================================

export function xmlEventsFeature(language) {
  language.setupListeners = instance => {
    const listeners = language.firstChildElement(instance.definition, 'listeners');
    if (!listeners) return;
    for (const listener of language.childElements(listeners, 'listener')) {
      const handler = listener.getAttribute('handler');

      // Signal-change listener: fires when the named signal's value changes.
      // Syntax: <listener signal="theme" handler="#onThemeChange" />
      //         <listener signal="pinned"><store signal="pinned" key="app:pinned"/></listener>
      // `$value` is available in inline operations and as a local in the action.
      if (listener.hasAttribute('signal')) {
        const signalName = listener.getAttribute('signal');
        const sig = instance.scope.signal(signalName);
        if (!sig) {
          console.warn(`[galath] <listener signal="${signalName}"> — no such signal`);
          continue;
        }
        instance.scope.collect(
          sig.subscribe(value => {
            const local = { $value: value, value };
            if (handler?.startsWith('#')) {
              language.executeAction(instance, handler.slice(1), local, null);
            } else {
              language.runOperations([...listener.children], instance, local, null);
            }
          }, false), // false = don't fire immediately on subscribe
        );
        continue;
      }

      // Data-tree event listener (original behaviour).
      // Requires an instance tree; skip silently when the component has none.
      if (!instance.tree) continue;
      const eventName = listener.getAttribute('event') || '*';
      const observer = listener.getAttribute('observer');
      instance.scope.collect(
        instance.tree.on(eventName, event => {
          if (observer && !event.path.startsWith(observer)) return;
          if (handler?.startsWith('#')) {
            language.executeAction(instance, handler.slice(1), {}, event);
          } else {
            language.runOperations([...listener.children], instance, {}, event);
          }
        }),
      );
    }
  };
}
