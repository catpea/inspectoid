# Story Card

Linked card for story overview grids, starters pages, and doc indexes. Uses icon + title + meta layout. A non-linked quality metric variant (`cf-quality-card`) is used in testing dashboards.

## Required Markup

```html
<!-- Story card (link) -->
<a class="cf-story-card" href="/stories/button--primary">
  <span class="cf-story-icon"><i class="bi bi-window-sidebar"></i></span>
  <div>
    <h2 class="cf-story-title">Component Workshop</h2>
    <p class="cf-muted mb-2">Default story tree and canvas.</p>
    <div class="cf-story-meta">
      <span class="badge text-bg-secondary">starter</span>
      <span>12 stories</span>
    </div>
  </div>
</a>

<!-- Quality card (non-link, metric) -->
<div class="cf-quality-card">
  <div class="cf-muted small mb-1">Visual Tests</div>
  <strong class="d-block h5 mb-0">24 <span class="text-success">✓</span></strong>
  <span class="cf-muted small">passing</span>
</div>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-story-card` | `a` | Flex card. Hover: lift (`translateY(-2px)`) + shadow. |
| `.cf-story-icon` | `span` | Gradient icon badge, 2.25rem square. Place a `bi-*` icon inside. |
| `.cf-story-title` | `h2`-`h6` | Card heading. 0.95rem, 700 weight. |
| `.cf-story-meta` | `div` | Flex row of tags and counts. Wraps on small widths. |
| `.cf-quality-card` | `div` | Non-linked metric card. 3px green top border. |

## Story Icon Reference

Common Bootstrap Icons to use inside `.cf-story-icon`:

| Icon class | Meaning |
|---|---|
| `bi-window-sidebar` | Component workshop / layout |
| `bi-braces` | Code / source |
| `bi-palette` | Design tokens / colors |
| `bi-sliders` | Controls / knobs |
| `bi-check2-circle` | Testing / quality |
| `bi-puzzle` | Addons / plugins |
| `bi-type` | Typography |
| `bi-grid-3x3-gap` | Spacing / layout |
| `bi-journal-code` | Documentation |
| `bi-shield-check` | Accessibility |
