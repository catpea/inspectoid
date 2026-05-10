// =============================================================================
// signals.js
//
// Reactivity primitives. Galath state lives in `Signal`s - tiny boxes around
// a value that notify subscribers when the value changes.
//
//   * Signal     - one reactive cell.
//   * Disposable - cancellable resource (we use this for subscriptions).
//   * Scope      - a tree of Disposables that auto-cleanup together.
//   * Concern    - a Scope that also owns a named-signal map (used by
//                  components and rendered scopes).
//
// We deliberately avoid implicit dependency tracking (a la Solid). Galath's
// renderer subscribes to *every* signal in the component scope plus the
// instance-tree version counter, then rebuilds the view. Trade-off: simpler
// mental model, less code, slightly less efficient. Since we morph the DOM
// (see morph.js) the cost is acceptable for typical UI sizes.
// =============================================================================

import { assert } from './core.js';

export function signalsAndScopesFeature(language) {
  // ---------------------------------------------------------------------------
  // Disposable
  // ---------------------------------------------------------------------------
  // Wraps a cleanup function. `dispose()` is idempotent - calling twice is
  // safe. Implements `Symbol.dispose` for forward-compat with the explicit
  // resource-management proposal (`using sub = signal.subscribe(...)`).
  // ---------------------------------------------------------------------------
  class Disposable {
    #fn;
    #done = false;
    constructor(fn) {
      this.#fn = fn;
    }
    dispose() {
      if (this.#done) return;
      this.#done = true;
      this.#fn?.();
    }
    [Symbol.dispose]() {
      this.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // Scope
  // ---------------------------------------------------------------------------
  // A tree node that owns child Scopes and a flat list of disposables. When
  // disposed, child scopes go first (LIFO across the tree), then the local
  // disposables (LIFO order so resources unwind in reverse-creation order,
  // mirroring how `try/finally` blocks behave).
  // ---------------------------------------------------------------------------
  class Scope {
    #items = [];
    #children = [];
    #done = false;
    #parent = null;

    /**
     * Add cleanups (functions or {dispose} objects). `null`/`undefined` is
     * silently ignored so callers can write `scope.collect(maybeNull)`.
     */
    collect(...items) {
      this.#items.push(...items.flat(Infinity).filter(Boolean));
      return this;
    }

    /** Open a child scope. Disposing the parent will dispose children first. */
    scope(name = 'scope') {
      const child = new Scope();
      child.name = name;
      child.#parent = this;
      this.#children.push(child);
      return child;
    }

    dispose() {
      if (this.#done) return;
      this.#done = true;
      // Children first - their cleanups may rely on parent state.
      for (const child of [...this.#children].reverse()) child.dispose();
      this.#children.length = 0;
      // Local items in reverse insertion order.
      const items = this.#items.splice(0);
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        try {
          if (typeof item === 'function') item();
          else if (item?.dispose) item.dispose();
          else if (item?.[Symbol.dispose]) item[Symbol.dispose]();
        } catch (error) {
          console.error('[Scope] dispose error:', error);
        }
      }
      // Detach from parent so re-disposing the parent doesn't try to dispose
      // us again.
      if (this.#parent) {
        this.#parent.#children = this.#parent.#children.filter(c => c !== this);
        this.#parent = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Signal
  // ---------------------------------------------------------------------------
  // Reactive cell. `Object.is` semantics avoid spurious notifications when a
  // primitive is set to its current value.
  //
  // `subscribe(fn, immediate=true)` mirrors RxJS BehaviorSubject - by
  // default the subscriber is invoked once with the current value so it can
  // initialize itself.
  // ---------------------------------------------------------------------------
  class Signal {
    #value;
    #subscribers = new Set();
    constructor(value) {
      this.#value = value;
    }
    get value() {
      return this.#value;
    }
    set value(next) {
      if (Object.is(next, this.#value)) return;
      this.#value = next;
      // Snapshot subscribers because handlers may unsubscribe during the loop.
      for (const fn of [...this.#subscribers]) fn(this.#value);
    }
    subscribe(fn, immediate = true) {
      if (typeof fn !== 'function') {
        throw new TypeError('Signal.subscribe expected a function.');
      }
      this.#subscribers.add(fn);
      if (immediate) fn(this.#value);
      return new Disposable(() => this.#subscribers.delete(fn));
    }
  }

  // ---------------------------------------------------------------------------
  // Concern
  // ---------------------------------------------------------------------------
  // A Scope plus a named-signal map. Every component instance owns a Concern
  // - the lifetime of its signals and subscriptions equals the lifetime of
  // the component.
  //
  // `map(name, source, fn)` is a tiny derived-signal helper; it creates a
  // new Signal whose value is `fn(source.value)` and keeps it in sync. We
  // also expose this as `<computed>` in the XML.
  // ---------------------------------------------------------------------------
  class Concern extends Scope {
    #signals = new Map();
    /**
     * Read or define a named signal.
     *   concern.signal('x') -> existing signal or undefined
     *   concern.signal('x', new Signal(0)) -> stores and returns the signal
     */
    signal(name, signal) {
      if (signal) this.#signals.set(name, signal);
      return this.#signals.get(name);
    }
    /** Iterate registered name/signal pairs. */
    signalEntries() {
      return [...this.#signals.entries()];
    }
    /**
     * Define a derived signal: `out.value = fn(source.value)` and stays in
     * sync with `source`. The subscription is collected by this concern, so
     * it auto-cleans on dispose.
     */
    map(name, source, fn) {
      const out = new Signal(fn(source.value));
      this.signal(name, out);
      this.collect(
        source.subscribe(value => {
          out.value = fn(value);
        }, false),
      );
      return out;
    }
  }

  // Expose to other features.
  language.Disposable = Disposable;
  language.Scope = Scope;
  language.Signal = Signal;
  language.Concern = Concern;

  // ---------------------------------------------------------------------------
  // Self-tests
  // ---------------------------------------------------------------------------
  language.test('signals: immediate delivery and Object.is suppression', () => {
    const s = new Signal(1);
    const seen = [];
    const sub = s.subscribe(v => seen.push(v));
    s.value = 1; // suppressed by Object.is
    s.value = 2;
    sub.dispose();
    s.value = 3; // ignored after dispose
    assert(JSON.stringify(seen) === JSON.stringify([1, 2]), 'bad signal sequence');
  });

  language.test('scope: child scopes dispose before parent resources', () => {
    const root = new Scope();
    const order = [];
    root.collect(() => order.push('root-a'));
    root.scope('child').collect(() => order.push('child-a'));
    root.collect(() => order.push('root-b'));
    root.dispose();
    assert(
      JSON.stringify(order) === JSON.stringify(['child-a', 'root-b', 'root-a']),
      'bad dispose order',
    );
  });
}
