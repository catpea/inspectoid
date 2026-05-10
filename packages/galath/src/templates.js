// =============================================================================
// templates.js
//
// `<datatemplate name="todo-card" for="todo">` declares a reusable view
// fragment. It's instantiated by `<items source=".../todo" template="todo-card" as="todo" />`
// in the rendering layer.
//
// This feature only collects the templates into an instance map. The render
// pipeline reads them when it encounters `<items>`.
//
// Why a separate registry instead of inlining?
//   * Lets templates be reused across multiple `<items>` blocks.
//   * Works well with `<import>` - a chapter can ship its own template
//     library and the consumer just references templates by name.
// =============================================================================

export function templateItemsFeature(language) {
  language.setupTemplates = instance => {
    instance.templates = new Map();
    for (const tpl of language.childElements(instance.definition, 'datatemplate')) {
      instance.templates.set(tpl.getAttribute('name'), tpl);
    }
  };
}
