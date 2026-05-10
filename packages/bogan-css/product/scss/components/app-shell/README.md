# App Shell

Root layout grid for the component-workshop UI. Implements the three-row shell (header / workbench / statusbar) and the three-column workbench (sidebar / center / docs panel).

## Required Markup

```html
<div class="cf-app">
  <header class="cf-header">
    <a class="cf-logo" href="/"><span class="cf-logo-mark"><i class="bi bi-braces"></i></span><span>App</span></a>
    <nav class="cf-header-nav">
      <a class="cf-header-link is-active" href="#">Stories</a>
      <a class="cf-header-link" href="#">Docs</a>
    </nav>
    <div class="cf-search">…</div>
  </header>

  <div class="cf-workbench has-docs">
    <aside class="cf-sidebar">…</aside>
    <main class="cf-center">
      <div class="cf-toolbar">…</div>
      <section class="cf-canvas">…</section>
      <section class="cf-addon-panel">…</section>
    </main>
    <aside class="cf-docs-panel">…</aside>
  </div>

  <footer class="cf-statusbar">
    <span>Ready</span><span>v0.1.0</span>
  </footer>
</div>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-app` | `div` | Root grid: 3 rows (header, workbench, statusbar). `min-height:100vh`. |
| `.cf-header` | `header` | Sticky top bar. Flex row. Contains logo, nav, search, actions. |
| `.cf-logo` | `a` | Brand link — mark + name. `text-decoration:none`. |
| `.cf-logo-mark` | `span` | Gradient icon badge (2rem square). Swap Bootstrap Icons class for branding. |
| `.cf-header-nav` | `nav` | Horizontal pill links. |
| `.cf-header-link` | `a` | Nav pill with hover/active states. |
| `.cf-search` | `div` | Search wrapper. Auto `margin-left:auto`. Max-width `28rem`. |
| `.cf-workbench` | `div` | 3-column grid: sidebar / center / docs. |
| `.cf-center` | `main` | Middle column: 3-row grid: toolbar / canvas / addon. |
| `.cf-statusbar` | `footer` | Slim bottom bar. Space-between flex. |

## Modifiers

| Modifier | On | Effect |
|---|---|---|
| `.is-active` | `.cf-header-link` | Active nav link (primary color, tinted bg). |
| `.has-docs` | `.cf-workbench` | Show the right docs panel column. |
| `.is-fullscreen` | `.cf-workbench` | Collapse sidebar + docs + addon. Canvas fills full width. |

## CSS Custom Properties

| Variable | Default | Controls |
|---|---|---|
| `--cf-header-height` | `3.75rem` | Header grid row height |
| `--cf-status-height` | `1.75rem` | Statusbar grid row height |
| `--cf-sidebar-width` | `16.25rem` | Left column width |
| `--cf-docs-width` | `20rem` | Right column width |
| `--cf-addon-height` | `15.5rem` | Addon panel row height |

## Accessibility

- Use `<header>`, `<main>`, `<aside>`, `<footer>` landmarks.
- Add `aria-label` to `<aside>` elements when multiple exist.
- Status bar should use `role="status"` or `aria-live="polite"` for dynamic messages.
