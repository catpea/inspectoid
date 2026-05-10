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
    if (!listeners || !instance.tree) return;
    for (const listener of language.childElements(listeners, 'listener')) {
      const eventName = listener.getAttribute('event') || '*';
      const observer = listener.getAttribute('observer');
      const handler = listener.getAttribute('handler');
      instance.scope.collect(
        instance.tree.on(eventName, event => {
          // Path filter: only fire when the event is at or under `observer`.
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
