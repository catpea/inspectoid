# Sidebar & Tree

Scrollable left column containing the story hierarchy. Groups of stories are separated by section labels. The active story leaf gets a primary-colored left accent stripe.

## Required Markup

```html
<aside class="cf-sidebar cf-scrollbar">
  <div class="cf-sidebar-header">
    <div class="d-flex align-items-center justify-content-between">
      <strong>Story Hierarchy</strong>
      <span class="badge text-bg-primary">42</span>
    </div>
  </div>
  <nav class="cf-tree">
    <div class="cf-tree-group">
      <div class="cf-tree-label"><i class="bi bi-folder2-open"></i>Components</div>
      <a class="cf-tree-item is-active" href="/stories/button--primary" data-cf-label="button primary">
        <i class="bi bi-record-circle"></i>Button / Primary
        <span class="cf-tree-badge">story</span>
      </a>
      <a class="cf-tree-item" href="/stories/button--secondary" data-cf-label="button secondary">
        <i class="bi bi-circle"></i>Button / Secondary
      </a>
    </div>
    <div class="cf-tree-group">
      <div class="cf-tree-label"><i class="bi bi-bezier2"></i>Design System</div>
      <a class="cf-tree-item" href="/stories/color-tokens" data-cf-label="color tokens">
        <i class="bi bi-palette"></i>Color Tokens
      </a>
    </div>
  </nav>
</aside>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-sidebar` | `aside` | Scrollable column. Surface background, right border. |
| `.cf-sidebar-header` | `div` | Sticky top row. Stays pinned while tree scrolls. |
| `.cf-tree` | `nav` | Padding wrapper. One `cf-tree` per visual group. |
| `.cf-tree-group` | `div` | Adds bottom margin between sibling groups. |
| `.cf-tree-label` | `div` | Section heading. Uppercase, non-interactive. |
| `.cf-tree-item` | `a` | Story leaf. Navigable link. |
| `.cf-tree-badge` | `span` | Right-aligned tag. Auto `margin-left:auto`. Use for "story", "docs", counts. |
| `.cf-resize-handle` | `div` | 4px drag target between sidebar and center. `cursor:col-resize`. |

## Modifiers

| Modifier | On | Effect |
|---|---|---|
| `.is-active` | `.cf-tree-item` | Primary text color + inset 3px left accent stripe. |

## Search Integration

Add `data-cf-search` to the search input. Add `data-cf-label="…"` (lowercase) to each `.cf-tree-item`. `components.js` hides non-matching items on `input` events.

```html
<input class="form-control" type="search" placeholder="Search…" data-cf-search>
<a class="cf-tree-item" href="#" data-cf-label="button primary">Button / Primary</a>
```

## Accessibility

- Wrap the tree in a `<nav>` landmark.
- The active link should reflect the current page route.
- The resize handle should have `role="separator"` and `aria-orientation="vertical"`.
