// =============================================================================
// boot.js
//
// `boot({ source, mount })` - the one-call setup. Creates a language, plugs
// every standard feature in the right order, and starts it. Returns the
// language object so callers can poke at internals (instance trees,
// signals, etc.) for debugging / testing.
//
// Order of features matters: core must come first (others depend on
// `language.parseSource`); rendering must come last (it uses helpers added
// by every other feature). The order encoded here is the canonical one.
// =============================================================================

import { createLanguage, coreFeature } from './core.js';
import { signalsAndScopesFeature } from './signals.js';
import { instanceModelFeature } from './instance-model.js';
import { bindingFeature } from './binding.js';
import { commandFeature } from './command.js';
import { controllerFeature } from './controller.js';
import { templateItemsFeature } from './templates.js';
import { behaviorFeature } from './behavior.js';
import { xmlEventsFeature } from './xml-events.js';
import { importFeature } from './imports.js';
import { componentFeature } from './component.js';
import { renderingFeature } from './rendering.js';

/**
 * Build a fully-loaded Galath language and `start()` it.
 *
 * @param {object} options
 * @param {string} options.source  - The Galath XML source.
 * @param {Element} options.mount  - Mount point for `<application>`.
 * @returns {Promise<object>} the started language.
 */
export async function boot({ source, mount }) {
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
    .use(renderingFeature);

  await language.start();
  return language;
}
