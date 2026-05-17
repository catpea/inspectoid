const root = document.documentElement;

const storage = {
  get(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures in embedded or private contexts.
    }
  },
  getJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

// ── Theme ─────────────────────────────────────────────────────────────────────

const setTheme = theme => {
  const resolved = theme === "auto"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  root.setAttribute("data-bs-theme", resolved);
  document.querySelectorAll("[data-cf-theme]").forEach(button => {
    const active = button.dataset.cfTheme === theme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
};

// Apply the stored theme immediately so there is no flash before galath renders.
setTheme(storage.get("componentsFantasyui.theme", "light"));

// ── Event-delegated click dispatch ────────────────────────────────────────────
// All button bindings use event delegation so they work with content that is
// rendered dynamically (e.g. by galath) after the initial DOMContentLoaded.

// Zoom state lives here so it persists across delegated click events.
let zoomLevel = 1;

// Canvas background cycle state.
const canvasBgs = ["", "is-white", "is-checkerboard"];
let canvasBgIdx = 0;

document.addEventListener("click", event => {
  // ── Theme toggle ────────────────────────────────────────────────────────────
  const themeBtn = event.target.closest("[data-cf-theme]");
  if (themeBtn) {
    event.preventDefault();
    const value = themeBtn.dataset.cfTheme || "light";
    storage.set("componentsFantasyui.theme", value);
    setTheme(value);
  }

  // ── Addon tabs (data-cf-tab / data-cf-pane) ─────────────────────────────────
  const addonTab = event.target.closest("[data-cf-tab]");
  if (addonTab) {
    const target = addonTab.dataset.cfTab;
    const panel = addonTab.closest(".cf-addon-panel");
    if (panel && target) {
      panel.querySelectorAll("[data-cf-tab]").forEach(item =>
        item.classList.toggle("is-active", item === addonTab),
      );
      panel.querySelectorAll("[data-cf-pane]").forEach(pane =>
        pane.classList.toggle("is-active", pane.dataset.cfPane === target),
      );
    }
  }

  // ── Docs panel toggle ───────────────────────────────────────────────────────
  const docsBtn = event.target.closest("[data-cf-toggle-docs]");
  if (docsBtn) {
    const workbench = document.querySelector(".cf-workbench");
    const docs = document.querySelector(".cf-docs-panel");
    if (workbench && docs) {
      const willShow = docs.classList.contains("is-hidden");
      docs.classList.toggle("is-hidden", !willShow);
      workbench.classList.toggle("has-docs", willShow);
      docsBtn.classList.toggle("is-active", willShow);
      docsBtn.setAttribute("aria-pressed", String(willShow));
    }
  }

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const fsBtn = event.target.closest("[data-cf-fullscreen]");
  if (fsBtn) {
    const workbench = document.querySelector(".cf-workbench");
    if (workbench) {
      const active = workbench.classList.toggle("is-fullscreen");
      fsBtn.classList.toggle("is-active", active);
      fsBtn.setAttribute("aria-pressed", String(active));
    }
  }

  // ── Addon panel collapse ────────────────────────────────────────────────────
  const addonsBtn = event.target.closest("[data-cf-toggle-addons]");
  if (addonsBtn) {
    const panel = document.querySelector(".cf-addon-panel");
    if (panel) {
      const collapsed = panel.classList.toggle("is-collapsed");
      addonsBtn.classList.toggle("is-active", !collapsed);
      addonsBtn.setAttribute("aria-pressed", String(!collapsed));
    }
  }

  // ── Viewport preset ─────────────────────────────────────────────────────────
  const vpBtn = event.target.closest("[data-cf-viewport]");
  if (vpBtn) {
    const preset = vpBtn.dataset.cfViewport;
    const frame = document.querySelector(".cf-preview-frame");
    if (frame) {
      frame.classList.remove("is-mobile", "is-tablet");
      if (preset === "mobile" || preset === "tablet") {
        frame.classList.add(`is-${preset}`);
      }
      document.querySelectorAll("[data-cf-viewport]").forEach(btn =>
        btn.classList.toggle("is-active", btn === vpBtn),
      );
    }
  }

  // ── Canvas zoom ─────────────────────────────────────────────────────────────
  const zoomBtn = event.target.closest("[data-cf-zoom]");
  if (zoomBtn) {
    const action = zoomBtn.dataset.cfZoom;
    const frame = document.querySelector(".cf-preview-frame");
    if (frame) {
      if (action === "in")    zoomLevel = Math.min(2,    +(zoomLevel + 0.1).toFixed(2));
      else if (action === "out") zoomLevel = Math.max(0.25, +(zoomLevel - 0.1).toFixed(2));
      else                    zoomLevel = 1;
      frame.style.setProperty("--cf-zoom", zoomLevel);
    }
  }

  // ── Canvas background cycle ─────────────────────────────────────────────────
  if (event.target.closest("[data-cf-canvas-bg]")) {
    const canvas = document.querySelector(".cf-canvas");
    if (canvas) {
      canvas.classList.remove("is-white", "is-checkerboard");
      canvasBgIdx = (canvasBgIdx + 1) % canvasBgs.length;
      if (canvasBgs[canvasBgIdx]) canvas.classList.add(canvasBgs[canvasBgIdx]);
    }
  }

  // ── Tree group collapse ─────────────────────────────────────────────────────
  const treeLabel = event.target.closest(".cf-tree-label");
  if (treeLabel && !event.target.closest(".cf-tree-item-pin")) {
    const group = treeLabel.closest(".cf-tree-group");
    if (group) {
      const collapsed = group.classList.toggle("is-collapsed");
      treeLabel.setAttribute("aria-expanded", String(!collapsed));
    }
  }

  // ── Recently visited: track tree-item clicks ────────────────────────────────
  const treeItem = event.target.closest(".cf-tree-item");
  if (treeItem && !treeItem.closest(".cf-tree-group-recent") && !treeItem.closest(".cf-tree-group-pinned") && !event.target.closest(".cf-tree-item-pin")) {
    const cfLabel = treeItem.dataset.cfLabel || "";
    const displayText = getDirectText(treeItem);
    const href = treeItem.getAttribute("href") || "#";

    const recent = getRecent().filter(r => r.label !== cfLabel || r.href !== href);
    recent.unshift({ label: cfLabel, text: displayText, href });
    setRecent(recent.slice(0, 5));
    renderRecent();
  }

  // ── Favourite / pin button ──────────────────────────────────────────────────
  const pinBtn = event.target.closest(".cf-tree-item-pin");
  if (pinBtn) {
    event.preventDefault();
    event.stopPropagation();

    const item = pinBtn.closest(".cf-tree-item");
    if (!item) return;

    const cfLabel = item.dataset.cfLabel || "";
    const displayText = getDirectText(item);
    const href = item.getAttribute("href") || "#";

    let pinned = getPinned();
    const idx = pinned.findIndex(p => p.label === cfLabel && p.href === href);

    if (idx >= 0) {
      pinned.splice(idx, 1);
      pinBtn.classList.remove("is-pinned");
      pinBtn.setAttribute("aria-label", "Pin story");
      pinBtn.innerHTML = '<i class="bi bi-star"></i>';
    } else {
      pinned.unshift({ label: cfLabel, text: displayText, href });
      pinBtn.classList.add("is-pinned");
      pinBtn.setAttribute("aria-label", "Unpin story");
      pinBtn.innerHTML = '<i class="bi bi-star-fill"></i>';
    }

    setPinned(pinned);
    renderPinned();
  }
});

// ── Search (delegated input event) ────────────────────────────────────────────
document.addEventListener("input", event => {
  const input = event.target.closest("[data-cf-search]");
  if (!input) return;
  const query = input.value.trim().toLowerCase();
  document.querySelectorAll("[data-cf-label]").forEach(item => {
    const label = item.dataset.cfLabel?.toLowerCase() || "";
    item.hidden = query.length > 0 && !label.includes(query);
  });
});

// ── Utility: extract direct text nodes only ───────────────────────────────────
// Used to build display text for recent/pinned items without picking up
// badge text, pin-button icon text, or other child-element content.
function getDirectText(el) {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
  }
  return text.replace(/\s+/g, " ").trim();
}

// ── Recently Visited ──────────────────────────────────────────────────────────
const RECENT_KEY = "componentsFantasyui.recent";
const getRecent = () => storage.getJSON(RECENT_KEY, []);
const setRecent = list => storage.setJSON(RECENT_KEY, list);

const renderRecent = () => {
  const tree = document.querySelector(".cf-tree");
  if (!tree) return;

  const existing = tree.querySelector(".cf-tree-group-recent");
  const recent = getRecent();

  if (!recent.length) {
    existing?.remove();
    return;
  }

  const group = existing || document.createElement("div");
  group.className = "cf-tree-group cf-tree-group-recent";
  group.innerHTML = "";

  const label = document.createElement("div");
  label.className = "cf-tree-label";
  label.innerHTML = '<i class="bi bi-clock-history me-1"></i>';
  label.appendChild(document.createTextNode("Recently Visited"));
  group.appendChild(label);

  recent.forEach(item => {
    const a = document.createElement("a");
    a.className = "cf-tree-item";
    a.href = item.href;
    if (item.label) a.dataset.cfLabel = item.label;
    const icon = document.createElement("i");
    icon.className = "bi bi-clock me-1";
    a.appendChild(icon);
    a.appendChild(document.createTextNode(item.text || item.label));
    group.appendChild(a);
  });

  if (!existing) {
    const pinnedGroup = tree.querySelector(".cf-tree-group-pinned");
    pinnedGroup ? tree.insertBefore(group, pinnedGroup.nextSibling) : tree.prepend(group);
  }
};

// ── Favourites / Pinned ───────────────────────────────────────────────────────
const PINNED_KEY = "componentsFantasyui.pinned";
const getPinned = () => storage.getJSON(PINNED_KEY, []);
const setPinned = list => storage.setJSON(PINNED_KEY, list);

const renderPinned = () => {
  const tree = document.querySelector(".cf-tree");
  if (!tree) return;

  const existing = tree.querySelector(".cf-tree-group-pinned");
  const pinned = getPinned();

  if (!pinned.length) {
    existing?.remove();
    return;
  }

  const group = existing || document.createElement("div");
  group.className = "cf-tree-group cf-tree-group-pinned";
  group.innerHTML = "";

  const label = document.createElement("div");
  label.className = "cf-tree-label";
  label.innerHTML = '<i class="bi bi-star-fill me-1" style="color:var(--cf-warning)"></i>';
  label.appendChild(document.createTextNode("Pinned"));
  group.appendChild(label);

  pinned.forEach(item => {
    const a = document.createElement("a");
    a.className = "cf-tree-item";
    a.href = item.href;
    if (item.label) a.dataset.cfLabel = item.label;
    const icon = document.createElement("i");
    icon.className = "bi bi-star-fill me-1";
    icon.style.color = "var(--cf-warning)";
    a.appendChild(icon);
    a.appendChild(document.createTextNode(item.text || item.label));
    group.appendChild(a);
  });

  if (!existing) tree.prepend(group);
};

// Inject a star pin button into a tree item if it doesn't already have one.
const attachPinButton = item => {
  if (item.querySelector(".cf-tree-item-pin")) return;
  if (item.closest(".cf-tree-group-recent") || item.closest(".cf-tree-group-pinned")) return;

  const cfLabel = item.dataset.cfLabel || "";
  const href = item.getAttribute("href") || "#";
  const isPinned = getPinned().some(p => p.label === cfLabel && p.href === href);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cf-tree-item-pin" + (isPinned ? " is-pinned" : "");
  btn.setAttribute("aria-label", isPinned ? "Unpin story" : "Pin story");
  btn.innerHTML = `<i class="bi ${isPinned ? "bi-star-fill" : "bi-star"}"></i>`;
  item.appendChild(btn);
};

// ── Source pane: copy buttons, line numbers, syntax highlighting ───────────────
// Uses MutationObserver so it works when the source pane is rendered dynamically
// (e.g. by galath's reactive <if> blocks) rather than being present at load time.

const attachSourceFeatures = pre => {
  if (!pre.closest("[data-cf-pane='source']")) return;

  const code = pre.querySelector("code");

  // Syntax highlighting (highlight.js must be loaded in the page)
  if (code && !code.classList.contains("hljs") && typeof hljs !== "undefined") {
    hljs.highlightElement(code);
  }

  // Line numbers via .cf-source-line spans.
  // Skipped when highlight.js has already processed the block because hljs
  // wraps tokens in its own spans which would be corrupted by a text split.
  if (code && !code.querySelector(".cf-source-line") && !code.classList.contains("hljs")) {
    const lines = code.textContent.split("\n");
    if (lines.at(-1) === "") lines.pop();
    code.innerHTML = lines
      .map(line => {
        const span = document.createElement("span");
        span.className = "cf-source-line";
        span.textContent = line;
        return span.outerHTML;
      })
      .join("");
  }

  // Copy-to-clipboard button
  if (!pre.querySelector(".cf-copy-btn")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-outline-secondary cf-copy-btn";
    btn.setAttribute("aria-label", "Copy source");
    btn.innerHTML = '<i class="bi bi-clipboard"></i>';

    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code");
      const text = code ? code.textContent : pre.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '<i class="bi bi-clipboard-check"></i>';
        btn.classList.add("text-success");
        setTimeout(() => {
          btn.innerHTML = '<i class="bi bi-clipboard"></i>';
          btn.classList.remove("text-success");
        }, 1500);
      } catch { /* clipboard unavailable */ }
    });

    pre.appendChild(btn);
  }
};

// ── MutationObserver: watch the entire body for dynamic content ───────────────
// A single observer handles all dynamic features to avoid creating multiple
// observers that each scan the same subtree additions.

new MutationObserver(records => {
  for (const r of records) {
    for (const node of r.addedNodes) {
      if (node.nodeType !== 1) continue;

      // Source pane pre blocks
      const pres = node.tagName === "PRE" ? [node] : [...node.querySelectorAll("pre")];
      pres.forEach(attachSourceFeatures);

      // Tree items (attach pin button, re-render pinned + recent groups)
      const items = node.classList?.contains("cf-tree-item")
        ? [node]
        : [...node.querySelectorAll(".cf-tree-item")];
      items.forEach(attachPinButton);

      // Render pinned/recent once the tree container itself appears
      if (node.classList?.contains("cf-tree") || node.querySelector?.(".cf-tree")) {
        renderPinned();
        renderRecent();
      }
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// ── Initial wiring for static HTML pages ─────────────────────────────────────
// When bogan-css is used with a plain HTML file (no galath) all content is
// already in the DOM, so we run the attach functions immediately.

document.querySelectorAll("[data-cf-pane='source'] pre").forEach(attachSourceFeatures);
document.querySelectorAll(".cf-tree-item").forEach(attachPinButton);
renderPinned();
renderRecent();
