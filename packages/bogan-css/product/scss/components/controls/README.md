# Controls

Args editor grid for the Controls addon pane. Each control maps a story argument to a labeled form input. Also houses the action log, accessibility score, and source snippet patterns.

## Required Markup

```html
<!-- Controls pane -->
<div class="cf-control-grid">
  <label class="cf-control">
    <span class="cf-control-label">label <code>string</code></span>
    <input class="form-control form-control-sm" value="Button">
  </label>
  <label class="cf-control">
    <span class="cf-control-label">variant <code>enum</code></span>
    <select class="form-select form-select-sm">
      <option>primary</option><option>secondary</option>
    </select>
  </label>
  <label class="cf-control">
    <span class="cf-control-label">disabled <code>boolean</code></span>
    <select class="form-select form-select-sm">
      <option>false</option><option>true</option>
    </select>
  </label>
</div>

<!-- Actions pane -->
<ul class="cf-action-log">
  <li class="cf-action-log-item"><span>click</span><span>button.btn-primary</span></li>
  <li class="cf-action-log-item"><span>focus</span><span>input[name="email"]</span></li>
</ul>

<!-- Accessibility pane -->
<span class="cf-a11y-score"><i class="bi bi-check2-circle"></i>0 violations</span>
```

## Classes

| Class | Element | Description |
|---|---|---|
| `.cf-control-grid` | `div` | Auto-fill responsive grid. Min column width 14rem. |
| `.cf-control` | `label` | Vertical flex pair: label row + input. |
| `.cf-control-label` | `span` | Label row. Space-between. Uppercase, letter-spaced. Right side for type hint or reset button. |
| `.cf-action-log` | `ul` | Unstyled list for action event entries. |
| `.cf-action-log-item` | `li` | Event row. Monospace font. Left accent stripe (accent color). |
| `.cf-a11y-score` | `span` | Inline pass indicator (green, check icon). |

## Control Input Types

Any Bootstrap form control works inside `.cf-control`:

- Text: `<input class="form-control form-control-sm">`
- Number: `<input class="form-control form-control-sm" type="number">`
- Select (enum/boolean): `<select class="form-select form-select-sm">`
- Color: `<input class="form-control-color" type="color">`
- Range: `<input class="form-range" type="range">`
- Textarea: `<textarea class="form-control form-control-sm">`

## Reset Button Pattern

Use the right side of `.cf-control-label` for a reset link:

```html
<span class="cf-control-label">
  label <code>string</code>
  <button class="btn btn-link p-0 cf-muted" style="font-size:.72rem" type="button">Reset</button>
</span>
```
