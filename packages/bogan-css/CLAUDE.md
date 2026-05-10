# Components FantasyUI — AI Reference

Bootstrap 5 UI kit for building Storybook-style component workshop interfaces. The theme provides a three-column app shell (sidebar tree / canvas center / docs panel), a toolbar, a collapsible addon panel, controls editor, and story cards.

## Quick Start

```html
<link rel="stylesheet" href="product/css/components-fantasyui.min.css">
<script src="product/js/bootstrap.bundle.min.js"></script>
<script type="module" src="product/js/components.js"></script>
```

See `product/index.html` for the full reference implementation. See `product/reference.html` for every component in every state on one page.

---

## File Map

```
product/
  css/components-fantasyui.min.css   ← compiled theme (include this)
  js/bootstrap.bundle.min.js         ← Bootstrap JS
  js/components.js                   ← workshop interactivity
  index.html                         ← primary demo (full workshop)
  reference.html                     ← kitchen-sink: every class/state
  scss/
    main.scss                        ← entrypoint
    _tokens.scss                     ← brand colors, fonts
    _variables.scss                  ← Bootstrap variable overrides
    _root.scss                       ← CSS custom properties (light+dark)
    components/
      app-shell/_index.scss          ← .cf-app .cf-header .cf-workbench
      sidebar/_index.scss            ← .cf-sidebar .cf-tree .cf-tree-item
      toolbar/_index.scss            ← .cf-toolbar .cf-tool
      preview/_index.scss            ← .cf-canvas .cf-preview-frame
      controls/_index.scss           ← .cf-control-grid .cf-control
      docs/_index.scss               ← .cf-docs-panel .cf-props-table
      story-card/_index.scss         ← .cf-story-card .cf-quality-card
examples/
  component-workshop/index.html      ← starter: story tree + canvas
  design-system-docs/index.html      ← starter: docs-first layout
  testing-dashboard/index.html       ← starter: quality metrics
  addon-panel/index.html             ← starter: controls-heavy
```

---

## Full App Shell Skeleton

Every page follows this exact grid. Do not alter the nesting order.

```html
<!doctype html>
<html lang="en" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>…</title>
  <link rel="stylesheet" href="css/components-fantasyui.min.css">
</head>
<body>
<div class="cf-app">

  <!-- ① Header -->
  <header class="cf-header">
    <a class="cf-logo" href="/">
      <span class="cf-logo-mark"><i class="bi bi-braces"></i></span>
      <span>My Workshop</span>
    </a>
    <nav class="cf-header-nav">
      <a class="cf-header-link is-active" href="#">Stories</a>
      <a class="cf-header-link" href="#">Docs</a>
    </nav>
    <div class="cf-search">
      <div class="input-group input-group-sm">
        <span class="input-group-text bg-transparent"><i class="bi bi-search"></i></span>
        <input class="form-control" type="search" placeholder="Search stories…" data-cf-search>
      </div>
    </div>
  </header>

  <!-- ② Three-column workbench -->
  <!-- Add .has-docs to show right docs panel -->
  <!-- Add .is-fullscreen to collapse to canvas only -->
  <div class="cf-workbench has-docs">

    <!-- Left: story tree -->
    <aside class="cf-sidebar cf-scrollbar">
      <div class="cf-sidebar-header">
        <strong>Story Hierarchy</strong>
      </div>
      <nav class="cf-tree">
        <div class="cf-tree-group">
          <div class="cf-tree-label"><i class="bi bi-folder2-open"></i>Components</div>
          <a class="cf-tree-item is-active" href="#" data-cf-label="button primary">
            <i class="bi bi-record-circle"></i>Button / Primary
            <span class="cf-tree-badge">story</span>
          </a>
          <a class="cf-tree-item" href="#" data-cf-label="button secondary">
            <i class="bi bi-circle"></i>Button / Secondary
          </a>
        </div>
      </nav>
    </aside>

    <!-- Center: toolbar + canvas + addon panel -->
    <main class="cf-center">

      <!-- Toolbar -->
      <div class="cf-toolbar">
        <div class="cf-toolbar-group">
          <button class="cf-tool is-active" type="button"><i class="bi bi-window"></i>Canvas</button>
          <button class="cf-tool" type="button" data-cf-toggle-docs><i class="bi bi-file-text"></i>Docs</button>
          <button class="cf-tool" type="button" data-cf-toggle-addons><i class="bi bi-sliders"></i>Controls</button>
        </div>
        <span class="cf-toolbar-spacer"></span>
        <div class="cf-toolbar-group">
          <button class="btn btn-sm btn-outline-secondary cf-icon-button" type="button"
                  data-cf-fullscreen aria-label="Fullscreen"><i class="bi bi-arrows-fullscreen"></i></button>
        </div>
      </div>

      <!-- Canvas -->
      <section class="cf-canvas" aria-label="Story preview">
        <div class="cf-preview-frame">
          <div class="cf-preview-card">
            <!-- story content here -->
          </div>
        </div>
        <!-- Hidden loading overlay; add .is-visible to show -->
        <div class="cf-loading-overlay" aria-live="polite">
          <div class="spinner-border text-primary" role="status"></div>
        </div>
      </section>

      <!-- Addon panel -->
      <!-- Add .is-collapsed to hide -->
      <section class="cf-addon-panel">
        <div class="cf-tabbar" role="tablist">
          <button class="cf-addon-tab is-active" type="button" data-cf-tab="controls">Controls</button>
          <button class="cf-addon-tab" type="button" data-cf-tab="actions">Actions</button>
          <button class="cf-addon-tab" type="button" data-cf-tab="source">Source</button>
          <button class="cf-addon-tab" type="button" data-cf-tab="a11y">Accessibility</button>
        </div>
        <div class="cf-addon-content">
          <div class="cf-panel-pane is-active" data-cf-pane="controls">
            <div class="cf-control-grid">
              <label class="cf-control">
                <span class="cf-control-label">label <code>string</code></span>
                <input class="form-control form-control-sm" value="Button">
              </label>
            </div>
          </div>
          <div class="cf-panel-pane" data-cf-pane="actions">
            <ul class="cf-action-log">
              <li class="cf-action-log-item"><span>click</span><span>button.primary</span></li>
            </ul>
          </div>
          <div class="cf-panel-pane" data-cf-pane="source">
            <pre class="cf-preview-card cf-mono mb-0"><code>&lt;button class="btn btn-primary"&gt;Button&lt;/button&gt;</code></pre>
          </div>
          <div class="cf-panel-pane" data-cf-pane="a11y">
            <span class="cf-a11y-score"><i class="bi bi-check2-circle"></i>0 violations</span>
          </div>
        </div>
      </section>

    </main>

    <!-- Right: docs panel -->
    <!-- Add .is-hidden to collapse -->
    <aside class="cf-docs-panel">
      <div class="cf-docs-header">
        <h2 class="h5 mb-1">Button Component</h2>
        <p class="cf-muted small mb-0">Props and usage.</p>
      </div>
      <div class="cf-docs-body">
        <table class="cf-props-table">
          <thead><tr><th>Name</th><th>Type</th><th>Default</th></tr></thead>
          <tbody>
            <tr><td>label</td><td><code>string</code></td><td>—</td></tr>
            <tr><td>disabled</td><td><code>boolean</code></td><td>false</td></tr>
          </tbody>
        </table>
        <div class="cf-doc-example mt-3">
          <button class="btn btn-primary">Primary</button>
        </div>
      </div>
    </aside>

  </div><!-- /.cf-workbench -->

  <!-- ③ Status bar -->
  <footer class="cf-statusbar">
    <span><i class="bi bi-check-circle-fill text-success me-1"></i>Ready — 0 errors</span>
    <span>v0.1.0</span>
  </footer>

</div><!-- /.cf-app -->
<script src="js/bootstrap.bundle.min.js"></script>
<script type="module" src="js/components.js"></script>
</body>
</html>
```

---

## Component Class Reference

### App Shell

| Class | Element | Purpose |
|---|---|---|
| `.cf-app` | `div` | Root grid: header / workbench / statusbar rows. Sets `min-height:100vh`. |
| `.cf-header` | `header` | Sticky top bar. Flex row. |
| `.cf-logo` | `a` | Brand link — mark + name side by side. |
| `.cf-logo-mark` | `span` | Gradient icon square (swap the `bi-*` class). |
| `.cf-header-nav` | `nav` | Flex row of nav pill links. |
| `.cf-header-link` | `a` | Nav pill. Add `.is-active` for current section. |
| `.cf-search` | `div` | Search wrapper — pushed to right edge. |
| `.cf-workbench` | `div` | Three-column grid. |
| `.cf-workbench.has-docs` | | Show right docs column (default hidden). |
| `.cf-workbench.is-fullscreen` | | Collapse sidebar + docs + addon to canvas-only. |
| `.cf-center` | `main` | Middle column: toolbar / canvas / addon rows. |
| `.cf-statusbar` | `footer` | Slim bottom bar, space-between. |

### Sidebar & Tree

| Class | Element | Purpose |
|---|---|---|
| `.cf-sidebar` | `aside` | Scrollable left column. |
| `.cf-sidebar-header` | `div` | Sticky top row of the sidebar. |
| `.cf-tree` | `nav` | Padding wrapper for a group. |
| `.cf-tree-group` | `div` | Visual group with bottom margin. |
| `.cf-tree-label` | `div` | Section heading — uppercase, non-interactive. |
| `.cf-tree-item` | `a` | Story leaf link. |
| `.cf-tree-item.is-active` | | Primary color + left accent stripe. |
| `.cf-tree-badge` | `span` | Right-aligned meta tag (e.g. "story"). Auto-pushed right. |
| `.cf-resize-handle` | `div` | 4px drag target. `cursor:col-resize`. Hover → primary tint. |

### Toolbar

| Class | Element | Purpose |
|---|---|---|
| `.cf-toolbar` | `div` | Flex row bar above the canvas. |
| `.cf-toolbar-group` | `div` | Group of tools. Adjacent groups get an auto separator line. |
| `.cf-toolbar-spacer` | `span` | Flex-grow gap — pushes following groups to the right. |
| `.cf-tool` | `button` | Tool pill button. |
| `.cf-tool.is-active` | | Primary color + tinted background. |
| `.cf-shortcut` | `kbd` | Keyboard shortcut badge inside a tool button. |
| `.cf-icon-button` | `button` | 2rem square icon button. Use with `.btn.btn-sm.btn-outline-secondary`. |

### Canvas & Preview

| Class | Purpose |
|---|---|
| `.cf-canvas` | Dot-grid rendering surface. Centers content. Scrollable. |
| `.cf-canvas.is-dark` | Dark background canvas for dark-themed stories. |
| `.cf-preview-frame` | Elevated white panel (max-w 42rem) centered in the canvas. |
| `.cf-preview-card` | Flat bordered box — source blocks, inline examples. |
| `.cf-loading-overlay` | Absolute overlay with blur. Hidden by default. |
| `.cf-loading-overlay.is-visible` | Show the overlay. |

### Addon Panel

| Class | Purpose |
|---|---|
| `.cf-addon-panel` | Bottom panel. |
| `.cf-addon-panel.is-collapsed` | Hide the panel (toggled by `[data-cf-toggle-addons]`). |
| `.cf-tabbar` | Tab button row. |
| `.cf-addon-tab` | Tab button. |
| `.cf-addon-tab.is-active` | Selected tab — primary bottom border. |
| `.cf-addon-content` | Padded pane container. |
| `.cf-panel-pane` | Individual pane. Hidden by default. |
| `.cf-panel-pane.is-active` | Visible pane (matched via `data-cf-pane`). |
| `.cf-action-log` | `ul` for event entries. |
| `.cf-action-log-item` | Single event row — monospace, accent left stripe. |
| `.cf-a11y-score` | Inline success indicator (green, check icon). |

### Controls

| Class | Purpose |
|---|---|
| `.cf-control-grid` | Auto-fill grid — 14rem min column. |
| `.cf-control` | Label + input pair (`display:grid`, vertical). |
| `.cf-control-label` | Row: name left, type/reset right. Uppercase, letter-spaced. |

### Docs Panel

| Class | Purpose |
|---|---|
| `.cf-docs-panel` | Right column. Scrollable. |
| `.cf-docs-panel.is-hidden` | Collapsed (toggled by `[data-cf-toggle-docs]`). |
| `.cf-docs-header` | Sticky header row. |
| `.cf-docs-body` | Padded content area. |
| `.cf-props-table` | Full-width props table. Alternating rows. Monospace first column. |
| `.cf-doc-example` | Live component demo box (surface-2 background). |

### Story Cards

| Class | Purpose |
|---|---|
| `.cf-story-card` | Flex card link. Hover: lift + shadow. Use as `<a>`. |
| `.cf-story-icon` | Gradient icon badge (2.25rem square). Put a `bi-*` icon inside. |
| `.cf-story-title` | Card heading text. |
| `.cf-story-meta` | Flex row of tags/counts below title. |
| `.cf-quality-card` | Non-linked metric card. Green top border. |

### Utilities

| Class | Purpose |
|---|---|
| `.cf-muted` | Muted text color (`--cf-muted`). |
| `.cf-mono` | Monospace font family. |
| `.cf-fill` | `min-height:0` override for flex/grid children. |
| `.cf-scrollbar` | Thin custom scrollbar (auto-applied to `.cf-sidebar`, `.cf-canvas`, `.cf-docs-panel`). |

---

## JS Data Attributes (`components.js`)

| Attribute | Element | Behavior |
|---|---|---|
| `data-cf-search` | `input[type=search]` | Filters `[data-cf-label]` tree items on input. |
| `data-cf-label="…"` | `.cf-tree-item` | Text matched by search. Value: lowercase display name. |
| `data-cf-tab="<pane>"` | `.cf-addon-tab` | On click: activates matching `[data-cf-pane]` in the same `.cf-addon-panel`. |
| `data-cf-pane="<pane>"` | `.cf-panel-pane` | Pane target for tab switching. |
| `data-cf-toggle-docs` | `button` | Toggles `.cf-docs-panel.is-hidden` and `.cf-workbench.has-docs`. |
| `data-cf-toggle-addons` | `button` | Toggles `.cf-addon-panel.is-collapsed`. |
| `data-cf-fullscreen` | `button` | Toggles `.cf-workbench.is-fullscreen`. |
| `data-cf-theme="light\|dark\|auto"` | `button` | Sets `data-bs-theme` on `<html>`. Persisted to `localStorage`. |

---

## CSS Custom Properties

Set on `:root` (light) and `[data-bs-theme="dark"]`.

| Variable | Light | Dark | Use |
|---|---|---|---|
| `--cf-bg` | `#f7f9fc` | `#0b1020` | App background |
| `--cf-surface` | `#ffffff` | `#121827` | Cards, header, sidebar |
| `--cf-surface-2` | `#f0f4f8` | `#1c2537` | Inset areas, canvas bg |
| `--cf-text` | `#162033` | `#eef4ff` | Body text |
| `--cf-muted` | `#66758c` | `#a9b5c8` | Secondary text |
| `--cf-line` | `rgba(22,32,51,.12)` | `rgba(238,244,255,.14)` | Borders and dividers |
| `--cf-primary` | `#ff4785` | `#ff4785` | Primary accent (pink) |
| `--cf-accent` | `#1ea7fd` | `#1ea7fd` | Secondary accent (blue) |
| `--cf-success` | `#2fbf71` | `#2fbf71` | Success states |
| `--cf-warning` | `#f3aa35` | `#f3aa35` | Warning states |
| `--cf-danger` | `#ed5a5a` | `#ed5a5a` | Error/danger states |
| `--cf-header-height` | `3.75rem` | | Header row height |
| `--cf-status-height` | `1.75rem` | | Status bar row height |
| `--cf-sidebar-width` | `16.25rem` | | Sidebar column width |
| `--cf-docs-width` | `20rem` | | Docs panel column width |
| `--cf-addon-height` | `15.5rem` | | Addon panel row height |
| `--cf-radius` | `.75rem` | | Default border radius |
| `--cf-radius-sm` | `.375rem` | | Small border radius |

---

## Dark Mode

```html
<!-- Apply at the html element -->
<html data-bs-theme="dark">

<!-- Or toggle with a button (handled by components.js) -->
<button type="button" data-cf-theme="dark"><i class="bi bi-moon-stars"></i></button>
<button type="button" data-cf-theme="light"><i class="bi bi-sun"></i></button>
<button type="button" data-cf-theme="auto"><i class="bi bi-circle-half"></i></button>
```

---

## Storybook Concept Mapping

| Storybook concept | This theme |
|---|---|
| Story | A named example of one component state |
| Story hierarchy / sidebar | `.cf-sidebar` + `.cf-tree` groups and items |
| Canvas | `.cf-canvas` + `.cf-preview-frame` |
| Toolbar | `.cf-toolbar` + `.cf-tool` buttons |
| Addon panel | `.cf-addon-panel` with `.cf-tabbar` |
| Controls (knobs) | `.cf-control-grid` in the Controls pane |
| Actions | `.cf-action-log` in the Actions pane |
| Docs page | `.cf-docs-panel` or a docs-layout page |
| MDX doc block | `.cf-doc-example` + `.cf-props-table` |
| Story index / overview | Grid of `.cf-story-card` |
| Quality / test status | `.cf-quality-card` grid |
