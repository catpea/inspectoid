# Toolbar

Horizontal strip above the canvas. Houses view-mode tools (Canvas/Docs), addon toggles, and secondary icon buttons (fullscreen, zoom, reset). Adjacent groups receive an automatic vertical divider.

## Required Markup

```html
<div class="cf-toolbar">
  <div class="cf-toolbar-group">
    <button class="cf-tool is-active" type="button"><i class="bi bi-window"></i>Canvas</button>
    <button class="cf-tool" type="button" data-cf-toggle-docs><i class="bi bi-file-text"></i>Docs</button>
    <button class="cf-tool" type="button" data-cf-toggle-addons><i class="bi bi-sliders"></i>Controls</button>
    <button class="cf-tool" type="button"><i class="bi bi-activity"></i>Actions</button>
  </div>
  <span class="cf-toolbar-spacer"></span>
  <div class="cf-toolbar-group">
    <button class="btn btn-sm btn-outline-secondary cf-icon-button" type="button"
            data-cf-fullscreen aria-label="Fullscreen"><i class="bi bi-arrows-fullscreen"></i></button>
    <button class="btn btn-sm btn-outline-secondary cf-icon-button" type="button"
            aria-label="Zoom in"><i class="bi bi-zoom-in"></i></button>
    <button class="btn btn-sm btn-outline-secondary cf-icon-button" type="button"
            aria-label="Zoom out"><i class="bi bi-zoom-out"></i></button>
  </div>
</div>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-toolbar` | `div` | Flex row. Surface background, bottom border. |
| `.cf-toolbar-group` | `div` | Flex group of tools. Adjacent groups auto-separated by a 1px divider. |
| `.cf-toolbar-spacer` | `span` | Flex-grow gap — pushes following groups to the right edge. |
| `.cf-tool` | `button` | Pill tool button. Transparent background. |
| `.cf-shortcut` | `kbd` | Small keyboard shortcut badge inside a tool. |
| `.cf-icon-button` | `button` | 2rem × 2rem square icon button. Combine with `.btn.btn-sm.btn-outline-secondary`. |

## Modifiers

| Modifier | On | Effect |
|---|---|---|
| `.is-active` | `.cf-tool` | Primary text color + tinted background + border. |

## JS Data Attributes

| Attribute | Behavior |
|---|---|
| `data-cf-toggle-docs` | Toggles `.cf-docs-panel.is-hidden` and `.cf-workbench.has-docs`. |
| `data-cf-toggle-addons` | Toggles `.cf-addon-panel.is-collapsed`. |
| `data-cf-fullscreen` | Toggles `.cf-workbench.is-fullscreen`. |

## Keyboard Shortcut Badge

```html
<button class="cf-tool" type="button">
  Fullscreen <kbd class="cf-shortcut">F</kbd>
</button>
```

## Accessibility

- All `cf-tool` buttons need visible text or `aria-label`.
- Icon-only `cf-icon-button` buttons must have `aria-label`.
- Use `aria-pressed` on toggle tools (docs, addons, fullscreen). `components.js` manages this.
