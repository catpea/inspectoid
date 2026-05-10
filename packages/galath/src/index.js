// =============================================================================
// index.js
//
// Public surface of the Galath runtime.
//
// Two ways to use the library:
//
//   1. Compose your own:
//
//        import { createLanguage, coreFeature, ... } from 'galath';
//        const lang = createLanguage({ source, mount })
//          .use(coreFeature)
//          .use(...other features...)
//        await lang.start();
//
//   2. Boot with all features (the 99% case):
//
//        import { boot } from 'galath';
//        await boot({ source, mount });
//
// Re-exporting individual features lets advanced users swap one out (e.g. a
// custom rendering layer) without forking the package.
// =============================================================================

export { createLanguage, coreFeature, assert } from './core.js';
export { signalsAndScopesFeature } from './signals.js';
export { instanceModelFeature } from './instance-model.js';
export { bindingFeature } from './binding.js';
export { commandFeature } from './command.js';
export { controllerFeature } from './controller.js';
export { templateItemsFeature } from './templates.js';
export { behaviorFeature } from './behavior.js';
export { xmlEventsFeature } from './xml-events.js';
export { importFeature } from './imports.js';
export { componentFeature } from './component.js';
export { renderingFeature } from './rendering.js';
export { morph } from './morph.js';
export { boot } from './boot.js';
