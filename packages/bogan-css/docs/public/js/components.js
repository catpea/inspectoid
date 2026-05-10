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
};

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

const bindThemeButtons = () => {
  const initial = storage.get("componentsFantasyui.theme", "light");
  setTheme(initial);

  document.querySelectorAll("[data-cf-theme]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      const value = button.dataset.cfTheme || "light";
      storage.set("componentsFantasyui.theme", value);
      setTheme(value);
    });
  });
};

const bindTreeSearch = () => {
  const input = document.querySelector("[data-cf-search]");
  const items = document.querySelectorAll("[data-cf-label]");

  if (!input || !items.length) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    items.forEach(item => {
      const label = item.dataset.cfLabel?.toLowerCase() || "";
      item.hidden = query.length > 0 && !label.includes(query);
    });
  });
};

const bindAddonTabs = () => {
  document.querySelectorAll("[data-cf-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.cfTab;
      const panel = tab.closest(".cf-addon-panel");
      if (!panel || !target) return;

      panel.querySelectorAll("[data-cf-tab]").forEach(item => {
        item.classList.toggle("is-active", item === tab);
      });
      panel.querySelectorAll("[data-cf-pane]").forEach(pane => {
        pane.classList.toggle("is-active", pane.dataset.cfPane === target);
      });
    });
  });
};

const bindDocsToggle = () => {
  document.querySelectorAll("[data-cf-toggle-docs]").forEach(button => {
    button.addEventListener("click", () => {
      const workbench = document.querySelector(".cf-workbench");
      const docs = document.querySelector(".cf-docs-panel");
      if (!workbench || !docs) return;

      const willShow = docs.classList.contains("is-hidden");
      docs.classList.toggle("is-hidden", !willShow);
      workbench.classList.toggle("has-docs", willShow);
      button.classList.toggle("is-active", willShow);
      button.setAttribute("aria-pressed", String(willShow));
    });
  });
};

const bindFullscreen = () => {
  document.querySelectorAll("[data-cf-fullscreen]").forEach(button => {
    button.addEventListener("click", () => {
      const workbench = document.querySelector(".cf-workbench");
      if (!workbench) return;

      const active = workbench.classList.toggle("is-fullscreen");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
};

const bindAddonCollapse = () => {
  document.querySelectorAll("[data-cf-toggle-addons]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = document.querySelector(".cf-addon-panel");
      if (!panel) return;

      const collapsed = panel.classList.toggle("is-collapsed");
      button.classList.toggle("is-active", !collapsed);
      button.setAttribute("aria-pressed", String(!collapsed));
    });
  });
};

const init = () => {
  bindThemeButtons();
  bindTreeSearch();
  bindAddonTabs();
  bindDocsToggle();
  bindFullscreen();
  bindAddonCollapse();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
