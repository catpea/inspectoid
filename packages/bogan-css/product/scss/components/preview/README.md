# Canvas & Preview

Isolated story rendering surface. The canvas fills the center column and shows a dot-grid background. The preview frame floats centered inside it. A loading overlay covers the canvas during story transitions.

## Required Markup

```html
<section class="cf-canvas" aria-label="Story preview canvas">
  <div class="cf-preview-frame">
    <div class="cf-preview-card">
      <!-- story content here -->
      <button class="btn btn-primary">Button</button>
    </div>
  </div>
  <!-- Hidden by default; add .is-visible to show -->
  <div class="cf-loading-overlay" aria-live="polite">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading…</span>
    </div>
  </div>
</section>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-canvas` | `section` | Dot-grid rendering surface. Grid center. Scrollable. |
| `.cf-preview-frame` | `div` | Elevated white panel centered in canvas. Max-width 42rem. Uses `cf-panel` mixin. |
| `.cf-preview-card` | `div` | Flat bordered box. Used for source code blocks and inline examples inside frames. |
| `.cf-loading-overlay` | `div` | Absolute overlay over the full canvas. Backdrop blur. |

## Modifiers

| Modifier | On | Effect |
|---|---|---|
| `.is-dark` | `.cf-canvas` | Dark background (#090d18). Grid adapts to white lines. Set `data-bs-theme="dark"` on the same element for Bootstrap dark mode. |
| `.is-visible` | `.cf-loading-overlay` | Show the loading spinner. Hidden by default. |

## Fullscreen (parent modifier)

When `.cf-workbench.is-fullscreen` is active, the sidebar, docs panel, and addon panel are hidden via CSS. The workbench becomes a single column and the canvas fills the screen.

## Accessibility

- Use `aria-label` on `.cf-canvas` to name the landmark.
- Use `aria-live="polite"` on `.cf-loading-overlay` so screen readers announce story transitions.
