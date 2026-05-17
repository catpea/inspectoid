// =============================================================================
// morph.js
//
// A small, dependency-free DOM morpher.
//
// The Galath rendering pipeline produces a fresh HTML string on every change
// and would prefer to *replace* the DOM each time. That's catastrophic for UX:
// inputs lose focus, scroll positions reset, transitions tear. We can't ship
// that. Instead we compute the new HTML, parse it into an off-screen tree,
// and surgically rewrite the *live* tree to match the new tree, leaving every
// untouched node alone.
//
// This is the same job morphdom does. We write our own here because the
// project rule is "no external npm packages". Ours is intentionally short
// (~80 lines of logic) and tuned for Galath's needs:
//
//   * Preserve focus. If the user is typing in an <input> when the morph
//     happens, we DO NOT clobber their value or selection. We let the live
//     element keep its state and just sync attributes that aren't user-typed.
//
//   * Preserve checkbox / radio state in the same way.
//
//   * Match children purely by position. Galath's renderer emits stable order
//     based on selection results, so positional matching is fine. Keyed
//     reconciliation is intentionally out of scope - if you need stable
//     identity across reorders, write a `<datatemplate key="...">` and rely
//     on the rendering layer to emit a stable order.
//
//   * Skip subtrees the renderer marked `data-xes-frozen`. (Reserved for
//     future use; right now nothing emits it, but leaving the hook open lets
//     us escape-hatch later without touching every caller.)
//
// The exported function `morph(fromNode, toNode)` mutates `fromNode` in place
// so its content equals `toNode`. It returns nothing.
// =============================================================================

// Element tags whose content is "user input" - we should never overwrite
// `value`, `selectionStart`, etc. on these while they have focus.
const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Morph `fromNode` so it structurally matches `toNode`.
 * Both should be Elements (not DocumentFragments).
 *
 * IMPORTANT: when `fromNode` is a Custom Element (its tag contains a hyphen
 * AND it's a registered element), we sync ATTRIBUTES but never recurse into
 * its children. Custom elements own their internal DOM via their own
 * renderNow; parents must not clobber that. Attribute changes still flow,
 * which lets prop updates re-trigger the child component's render.
 */
export function morph(fromNode, toNode) {
  if (fromNode.nodeName !== toNode.nodeName) {
    fromNode.replaceWith(toNode);
    return;
  }
  syncAttributes(fromNode, toNode);
  if (isCustomElement(fromNode)) return; // its internals are not ours.
  syncChildren(fromNode, toNode);
}

function isCustomElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const name = el.localName;
  return name.includes('-') && !!customElements.get(name);
}

// -----------------------------------------------------------------------------
// Attribute sync
// -----------------------------------------------------------------------------
// Walk the new attribute set and copy values across; remove attributes that
// don't exist in the new tree. We special-case form fields so that an input
// being edited doesn't have its `value` ripped out from under the user.
//
// CLASS MERGING
// Galath stamps `data-xes-classes` on every element whose classes it manages.
// When that attribute is present on either side, we do a surgical merge instead
// of a full class replace:
//   - classes galath owned before but no longer wants → removed
//   - classes galath now wants → added
//   - all other classes (added by external JS like bogan-css) → untouched
//
// This eliminates the "is-active flicker" where bogan-css adds a class and
// galath's next morph wipes it out.
// -----------------------------------------------------------------------------
function syncAttributes(fromEl, toEl) {
  const isFocusedInput =
    fromEl === document.activeElement && FORM_TAGS.has(fromEl.tagName);

  // Read the galath-owned class sets from both sides up front so we can
  // apply smart merging whenever `class` is touched below.
  const newGalathClasses = new Set(
    (toEl.getAttribute('data-xes-classes') ?? '').split(/\s+/).filter(Boolean),
  );
  const oldGalathClasses = new Set(
    (fromEl.getAttribute('data-xes-classes') ?? '').split(/\s+/).filter(Boolean),
  );
  const hasClassTracking =
    toEl.hasAttribute('data-xes-classes') || fromEl.hasAttribute('data-xes-classes');

  // Copy/replace attributes from the new element.
  for (const attr of toEl.attributes) {
    // The DOM `value` attribute is only the *initial* value of an input, but
    // many devs (and Galath bindings) write to .value as a property. If the
    // input is currently focused we leave its live value alone.
    if (isFocusedInput && (attr.name === 'value' || attr.name === 'checked')) continue;

    if (attr.name === 'class' && hasClassTracking) {
      mergeClasses(fromEl, oldGalathClasses, newGalathClasses);
      continue;
    }

    if (fromEl.getAttribute(attr.name) !== attr.value) {
      fromEl.setAttribute(attr.name, attr.value);
    }
  }

  // Remove attributes that no longer exist in the new tree.
  // We iterate over a snapshot because we mutate during the loop.
  for (const attr of [...fromEl.attributes]) {
    if (!toEl.hasAttribute(attr.name)) {
      if (isFocusedInput && (attr.name === 'value' || attr.name === 'checked')) continue;

      if (attr.name === 'class' && hasClassTracking) {
        // Galath dropped all its classes this render; preserve external ones.
        mergeClasses(fromEl, oldGalathClasses, newGalathClasses);
        continue;
      }

      fromEl.removeAttribute(attr.name);
    }
  }

  // Sync the `value` *property* of form inputs that aren't focused. The
  // attribute alone doesn't update the live input box once it's been typed
  // into.
  if (FORM_TAGS.has(fromEl.tagName) && !isFocusedInput) {
    const newValue = toEl.getAttribute('value') ?? '';
    if (fromEl.value !== newValue) fromEl.value = newValue;
    if ('checked' in fromEl) {
      const newChecked = toEl.hasAttribute('checked');
      if (fromEl.checked !== newChecked) fromEl.checked = newChecked;
    }
  }
}

// Surgically update `fromEl`'s class list:
//   remove classes galath no longer owns, add classes it now owns,
//   leave everything else (external JS additions) untouched.
function mergeClasses(fromEl, oldGalathClasses, newGalathClasses) {
  const live = new Set(fromEl.className.split(/\s+/).filter(Boolean));
  for (const cls of oldGalathClasses) {
    if (!newGalathClasses.has(cls)) live.delete(cls);
  }
  for (const cls of newGalathClasses) live.add(cls);
  if (live.size === 0) {
    if (fromEl.hasAttribute('class')) fromEl.removeAttribute('class');
    return;
  }
  const merged = [...live].join(' ');
  if (fromEl.className !== merged) fromEl.className = merged;
}

// -----------------------------------------------------------------------------
// Children sync
// -----------------------------------------------------------------------------
// Pair children by index. Where a child changes type (e.g. <span> became
// <div>), we replace it. Where it's the same tag, we recurse. Where the new
// tree has fewer children, we trim. Where it has more, we append.
//
// Text nodes are handled specially because they can't be morphed - we just
// overwrite their `data` property when it differs.
// -----------------------------------------------------------------------------
function syncChildren(fromEl, toEl) {
  const fromChildren = [...fromEl.childNodes];
  const toChildren = [...toEl.childNodes];

  // Keyed fast path: when *every* element child of the new tree carries
  // `data-xes-key`, reconcile by key instead of by position. This survives
  // reorders without churning DOM that just changed places.
  if (allKeyed(toChildren)) {
    syncKeyedChildren(fromEl, fromChildren, toChildren);
    return;
  }

  const max = Math.max(fromChildren.length, toChildren.length);

  for (let i = 0; i < max; i++) {
    const fromChild = fromChildren[i];
    const toChild = toChildren[i];

    if (!toChild) {
      // New tree is shorter - drop the extra live node.
      fromChild.remove();
      continue;
    }

    if (!fromChild) {
      // New tree is longer - append the new node (cloned so the off-screen
      // template stays reusable).
      fromEl.appendChild(toChild.cloneNode(true));
      continue;
    }

    // Both exist at this index. Decide what to do based on node types.
    if (fromChild.nodeType !== toChild.nodeType) {
      // E.g. text became element. Just replace.
      fromChild.replaceWith(toChild.cloneNode(true));
      continue;
    }

    if (fromChild.nodeType === Node.TEXT_NODE) {
      if (fromChild.data !== toChild.data) fromChild.data = toChild.data;
      continue;
    }

    if (fromChild.nodeType === Node.COMMENT_NODE) {
      // Comments rarely matter for behavior; sync data anyway.
      if (fromChild.data !== toChild.data) fromChild.data = toChild.data;
      continue;
    }

    if (fromChild.nodeType === Node.ELEMENT_NODE) {
      // Future hook: a renderer can mark a subtree `data-xes-frozen` to opt
      // out of morphing. Today nothing emits it. Cheap to keep.
      if (fromChild.hasAttribute && fromChild.hasAttribute('data-xes-frozen')) continue;

      if (fromChild.nodeName !== toChild.nodeName) {
        fromChild.replaceWith(toChild.cloneNode(true));
        continue;
      }

      // Same tag. Recurse.
      morph(fromChild, toChild);
    }
  }
}

// Returns true when there is at least one element child and every element
// child has `data-xes-key`. Non-element nodes (text, comments) are ignored
// for this decision but are dropped during the keyed sync.
function allKeyed(nodes) {
  let any = false;
  for (const n of nodes) {
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    if (!n.hasAttribute || !n.hasAttribute('data-xes-key')) return false;
    any = true;
  }
  return any;
}

// Reorder `fromEl`'s children to match `toChildren` by key. Existing nodes
// are MOVED (not recreated) so their internal state - input value, scroll,
// focus, attached listeners - survives a list reorder. Missing keys are
// inserted from a deep clone of the new template; surplus keyed nodes are
// removed.
function syncKeyedChildren(fromEl, fromChildren, toChildren) {
  // Drop any non-keyed live children up front; they don't survive keying.
  for (const child of fromChildren) {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    if (!child.hasAttribute('data-xes-key')) child.remove();
  }
  const byKey = new Map();
  for (const child of [...fromEl.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE && child.hasAttribute('data-xes-key')) {
      byKey.set(child.getAttribute('data-xes-key'), child);
    }
  }
  const used = new Set();
  for (const newChild of toChildren) {
    if (newChild.nodeType !== Node.ELEMENT_NODE) continue;
    const key = newChild.getAttribute('data-xes-key');
    const existing = byKey.get(key);
    if (existing) {
      // appendChild on a child already inside fromEl moves it, which is
      // exactly what we want for "place at the next position".
      fromEl.appendChild(existing);
      morph(existing, newChild);
      used.add(key);
    } else {
      fromEl.appendChild(newChild.cloneNode(true));
    }
  }
  for (const [key, el] of byKey) {
    if (!used.has(key) && el.parentNode === fromEl) el.remove();
  }
}
