# Docs Panel

Right-side documentation panel. Lives in the third column of `.cf-workbench.has-docs`. Contains a sticky header, a scrollable body with props tables and live examples. Collapsed by `[data-cf-toggle-docs]`.

## Required Markup

```html
<aside class="cf-docs-panel">
  <div class="cf-docs-header">
    <h2 class="h5 mb-1">Button Component</h2>
    <p class="cf-muted small mb-0">Usage, props, and story references.</p>
  </div>
  <div class="cf-docs-body">
    <h3 class="h6">Overview</h3>
    <p>The button communicates a user action.</p>

    <h3 class="h6 mt-4">Props</h3>
    <table class="cf-props-table">
      <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Required</th></tr></thead>
      <tbody>
        <tr><td>label</td><td><code>string</code></td><td>—</td><td>Yes</td></tr>
        <tr><td>disabled</td><td><code>boolean</code></td><td>false</td><td>No</td></tr>
      </tbody>
    </table>

    <h3 class="h6 mt-4">Example</h3>
    <div class="cf-doc-example">
      <button class="btn btn-primary">Primary</button>
    </div>
  </div>
</aside>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-docs-panel` | `aside` | Right column. Scrollable. |
| `.cf-docs-header` | `div` | Sticky header. Stays pinned while body scrolls. |
| `.cf-docs-body` | `div` | Padded content area for prose, tables, examples. |
| `.cf-props-table` | `table` | Full-width props table. Alternating rows. First column: monospace primary color. |
| `.cf-doc-example` | `div` | Live component demo box. Surface-2 background with inset shadow. |

## Modifiers

| Modifier | On | Effect |
|---|---|---|
| `.is-hidden` | `.cf-docs-panel` | Hide the panel. `[data-cf-toggle-docs]` manages this. |

## Toggling

```html
<!-- Toolbar button -->
<button class="cf-tool" type="button" data-cf-toggle-docs aria-pressed="true">
  <i class="bi bi-file-text"></i>Docs
</button>
<!-- components.js toggles:
     .cf-docs-panel → .is-hidden
     .cf-workbench  → .has-docs -->
```
