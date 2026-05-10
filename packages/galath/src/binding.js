// =============================================================================
// binding.js
//
// Expression evaluation, value resolution, and HTML escaping for templates.
//
// Galath expressions appear in three places:
//
//   1. Attribute interpolation:  class="card {active ? 'on' : ''}"
//   2. Bind shorthand:           bind:value="/draft/@text"
//   3. Inline event code:        on:click="set('x', 1)"
//
// All three flow through `evaluate(expr, instance, local, fallback, event)`,
// which:
//
//   * Tries a *path* shortcut first (`/foo/@bar`, `$todo`, `signalName`).
//     Plain identifiers and paths skip JS entirely - that's both faster and
//     safer (no eval needed for the 90% case).
//
//   * Falls back to `Function('ctx', 'with(ctx) { return (expr); }')` so
//     real expressions like `count > 0 && !disabled` still work. The `with`
//     block puts every signal value, every helper (`select`, `valueOf`,
//     `set`, `uid`, `deleteNode`...), and every loop-local (`$todo`,
//     `index`) in scope. We *do* run user code via Function() - this is the
//     same threat surface as putting code in `<eval>`. Galath sources are
//     authored, not user-supplied; treat them like any other web page code.
//
//   * Catches exceptions and returns a fallback so a single broken
//     attribute doesn't blank out the whole view. The renderer logs the
//     failure to the console.
//
// `interpolate(text)` runs `{...}` placeholders through `evaluate` and HTML-
// escapes the result by default - this is *crucial* for safety. A signal
// containing user-supplied text must never be injected as raw markup.
// =============================================================================

import { assert } from './core.js';

export function bindingFeature(language) {
  /**
   * Standard HTML escape. Used for any value that goes into the rendered
   * HTML string before the browser parses it.
   */
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /**
   * Build the context object passed to evaluated expressions. This is the
   * runtime "global" of Galath expressions:
   *
   *   * Every signal name is a property holding its current value.
   *   * Every loop variable from `<repeat as="x">` (and its `$x` form).
   *   * `$event` - the originating DOM event (for on:* handlers).
   *   * Helper functions: `uid`, `select`, `valueOf`, `set`, `attr`,
   *     `deleteNode`, `setNode`.
   *
   * Helpers are intentionally minimal. Anything more advanced should live
   * in a `<controller>` action where it's reviewable and reusable.
   *
   * The context is a Proxy so that signal reads are *recorded* on
   * `instance.readSignals` (when set). The renderer uses that record to
   * subscribe only to signals that the last render actually consulted -
   * unrelated signal changes no longer schedule a render. Helpers and
   * locals fall through to the underlying object; unrecognized names
   * fall through to the outer scope (via `with`'s standard chain) so
   * globals like `Number`, `Math`, etc. still resolve.
   */
  function buildContext(instance, local = {}, event = null) {
    const base = {
      ...local,
      $event: event,
      uid: language.uid,
      select: path => instance.tree?.select(path, local) ?? [],
      valueOf: path => valueOf(path, instance, local),
      set: (name, value) => {
        const sig = instance.scope.signal(name);
        if (sig) sig.value = value;
      },
      attr: (node, name) => node?.get?.(name) ?? '',
      deleteNode: node => node?.remove(),
      setNode: (node, name, value) => node?.set?.(name, value),
      // Climb to the nearest enclosing component instance and read one of
      // its signals. Returns '' when no parent is found - keeps
      // expressions safe even if the component is mounted standalone.
      parentSignal: name => language.parentSignal?.(instance, name) ?? '',
      // XForms-style validation helpers. They read the `<bind>` declarations
      // collected during setupModel and evaluate them against the live
      // instance value. `valid('/path')` returns true when every applicable
      // bind passes; `invalid` is its inverse. `required('/path')` reports
      // whether the path was declared required. `validity('/path')` returns
      // a summary object so views can show targeted error messages.
      valid: path => language.checkValidity?.(instance, path, local).valid ?? true,
      invalid: path => !(language.checkValidity?.(instance, path, local).valid ?? true),
      required: path => language.checkValidity?.(instance, path, local).required ?? false,
      validity: path => language.checkValidity?.(instance, path, local) ?? { valid: true },
    };
    return new Proxy(base, {
      get(target, key) {
        if (key in target) return target[key];
        const sig = instance.scope?.signal?.(key);
        if (sig) {
          instance.readSignals?.add(key);
          return sig.value;
        }
        return undefined;
      },
      has(target, key) {
        if (key in target) return true;
        return Boolean(instance.scope?.signal?.(key));
      },
    });
  }

  /**
   * Return the value at `path` from the instance tree, falling back to a
   * named signal if the tree has no match.
   */
  function valueOf(path, instance, local = {}) {
    if (instance.tree) {
      const treeValue = instance.tree.valueOf(path, local);
      if (treeValue !== '') return treeValue;
    }
    const sig = instance.scope?.signal?.(path);
    if (sig) {
      instance.readSignals?.add(path);
      return sig.value;
    }
    return '';
  }

  /**
   * The hot path. Evaluate `expr` against the instance + local context.
   *
   * Returns `fallback` if evaluation throws (and logs to the console). We
   * pick the cheap path - signal name or path lookup - first. Only when
   * neither matches do we compile a Function.
   */
  function evaluate(expr, instance, local = {}, fallback = '', event = null) {
    const direct = simplePathValue(expr, instance, local);
    if (direct.found) return direct.value;
    try {
      // eslint-disable-next-line no-new-func
      return Function(
        'ctx',
        `with (ctx) { return (${expr}); }`,
      )(buildContext(instance, local, event));
    } catch (error) {
      console.warn('[galath] expression failed:', expr, error);
      return fallback;
    }
  }

  /**
   * Run `code` for side effects (no return value). Used by `on:click` and
   * `<eval>` operations.
   */
  function run(code, instance, local = {}, event = null) {
    try {
      // eslint-disable-next-line no-new-func
      return Function(
        'ctx',
        `with (ctx) { ${code}; }`,
      )(buildContext(instance, local, event));
    } catch (error) {
      console.error('[galath] handler failed:', code, error);
    }
  }

  /**
   * Cheap shortcut for "the expression is just a name or a path". Avoids
   * compiling a Function for the most common case.
   *
   * IMPORTANT: only return a path-style match when the expression has no
   * JS operators / whitespace. Otherwise something like
   *   $book/@done ? 'on' : 'off'
   * would short-circuit on the leading `$`, return the boolean, and drop
   * the ternary.
   */
  function simplePathValue(expr, instance, local) {
    expr = String(expr ?? '').trim();
    const sig = instance.scope?.signal?.(expr);
    if (sig) {
      instance.readSignals?.add(expr);
      return { found: true, value: sig.value };
    }
    if (
      (expr.startsWith('/') || expr.startsWith('$')) &&
      !JS_EXPRESSION_HINT.test(expr)
    ) {
      return { found: true, value: instance.tree?.valueOf(expr, local) ?? '' };
    }
    return { found: false, value: undefined };
  }

  // Any of these characters mean the expression isn't a bare path - it's
  // JS we need to compile. We do NOT include parens because `text()`
  // selectors use them and the JS evaluator can't parse `/foo/text()`
  // (it parses as `/regex/ / text()`). We do NOT include `*` because it
  // appears in wildcard path steps. If you write `$a + $b`, the `+`
  // catches it. Dot is included so `$event.currentTarget...` remains normal
  // JavaScript property access instead of being mistaken for an XML path.
  const JS_EXPRESSION_HINT = /[\s.?<>&|,;!{}]/;

  /**
   * Replace `{expr}` placeholders inside a template string. By default the
   * result is HTML-escaped. Pass `{ raw: true }` to skip escaping (for
   * places like component attributes whose value is parsed again later).
   */
  function interpolate(text, instance, local = {}, options = {}) {
    const rendered = String(text ?? '').replace(/\{([^}]+)\}/g, (_, expression) =>
      String(evaluate(expression.trim(), instance, local)),
    );
    return options.raw ? rendered : escapeHtml(rendered);
  }

  // Publish helpers.
  language.escapeHtml = escapeHtml;
  language.evaluate = evaluate;
  language.run = run;
  language.valueOf = valueOf;
  language.interpolate = interpolate;
  language.buildContext = buildContext;

  // ---------------------------------------------------------------------------
  // Self-tests
  // ---------------------------------------------------------------------------
  language.test('binding: interpolation escapes embedded markup', () => {
    const fake = { scope: new language.Concern('test'), tree: null };
    fake.scope.signal('snippet', new language.Signal('<x-unsafe></x-unsafe>'));
    const r = interpolate('{snippet}', fake);
    assert(r.includes('&lt;x-unsafe&gt;'), 'snippet was not escaped');
  });

  language.test('binding: dotted event expressions evaluate as JavaScript', () => {
    const fake = { scope: new language.Concern('test'), tree: null };
    const event = { currentTarget: { dataset: { chapterId: 'signals' } } };
    assert(
      evaluate('$event.currentTarget.dataset.chapterId', fake, {}, '', event) === 'signals',
      'dotted $event expression was treated as a data path',
    );
  });
}
