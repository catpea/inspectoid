// =============================================================================
// playground/components/run-snippet.js
//
// Wires up the playground's "Run" button. Each chapter's source listing is a
// CDATA-wrapped XML fragment in a signal called `snippet`. When the user
// clicks Run we package that fragment into a complete HTML document - import
// map, Bootstrap CSS, mount node, two-line boot - and open the result in a
// new tab via a Blob URL.
//
// Two cases:
//
//   * Snippet contains a <component> definition. We honor the component's
//     declared `tag` and instantiate it once inside the <application>.
//     Falls back to <x-demo /> if the snippet's component has no tag.
//
//   * Snippet is a bare view fragment. We wrap it in a tiny synthetic
//     component named "demo" tagged x-demo and instantiate that.
//
// This is intentionally pragmatic: not every snippet stands alone (some
// reference signals or instance trees that only the chapter declares). The
// Run button is a "show this works in isolation" affordance, not a perfect
// playground reproduction.
// =============================================================================

function urlFor(relative) {
  // Resolve relative to the current document so the new tab can pull
  // Galath and CSS from the same dev server origin.
  return new URL(relative, window.location.href).toString();
}

function pickTag(snippet) {
  const m = snippet.match(/<component\b[^>]*\btag\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function buildDocument(snippet) {
  const galathBoot = urlFor('./node_modules/galath/src/boot.js');
  const galathBase = urlFor('./node_modules/galath/src/index.js');
  const cssBase    = urlFor('./node_modules/galath-css/css/');

  const componentTag = pickTag(snippet);
  let body;
  if (/<component\b/.test(snippet)) {
    const tag = componentTag || 'x-demo';
    body = `${snippet}\n      <application><${tag} /></application>`;
  } else {
    body = `<component name="demo" tag="x-demo">
        <view>
${snippet}
        </view>
      </component>
      <application><x-demo /></application>`;
  }

  return `<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Galath snippet</title>
  <link href="${cssBase}bootstrap.min.css" rel="stylesheet">
  <link href="${cssBase}bootstrap-icons.min.css" rel="stylesheet">
  <script type="importmap">
    { "imports": {
      "galath": "${galathBase}",
      "galath/boot": "${galathBoot}"
    } }
  </script>
  <style>
    body { padding: 1.5rem; min-height: 100vh; background: #06101f; color: #d8e1ec; }
    .xes-pad { max-width: 60rem; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="xes-pad">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <strong>Galath snippet</strong>
      <small class="text-secondary">Generated from the playground &middot; close this tab when you are done.</small>
    </div>
    <div id="mount"></div>
  </div>
  <script type="application/xml" id="src">
    <galath xmlns:bind="urn:galath:bind" xmlns:on="urn:galath:on" xmlns:use="urn:galath:use" xmlns:drag="urn:galath:drag" xmlns:drop="urn:galath:drop" xmlns:class="urn:galath:class">
      ${body}
    </galath>
  </script>
  <script type="module">
    import { boot } from 'galath/boot';
    try {
      await boot({
        source: document.getElementById('src').textContent,
        mount:  document.getElementById('mount'),
      });
    } catch (error) {
      document.getElementById('mount').innerHTML =
        '<pre style="color:#ff8080;white-space:pre-wrap">' +
        String(error && error.stack || error) + '</pre>';
      throw error;
    }
  </script>
</body>
</html>`;
}

export function runSnippet(snippet) {
  if (!snippet) return;
  const html = buildDocument(String(snippet));
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  // Revoke after a short delay so the new tab finishes loading first.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  window.open(url, '_blank', 'noopener');
}

export function attachRunSnippet() {
  // Expose globally so chapter source-card buttons can call it inline via
  // `on:click="window.galathRunSnippet(snippet)"` without needing a
  // dedicated controller action in every chapter.
  window.galathRunSnippet = runSnippet;
}
