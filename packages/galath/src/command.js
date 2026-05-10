// =============================================================================
// command.js
//
// XUL-style commandsets. A `<commandset>` block declares named commands
// with optional `enabled="..."` predicates. Buttons / menu items reference
// them with `command="addTodo"` and the runtime wires up:
//
//   * Click -> execute the command operations.
//   * Enabled state -> the button is `disabled` whenever the predicate is
//     falsey, automatically re-evaluated as part of the render pass.
//
// Operations live as the children of `<command>` and are interpreted by
// `controller.runOperations` (see controller.js). This file only registers
// commands and exposes execute/enabled helpers.
// =============================================================================

export function commandFeature(language) {
  /**
   * Scan a component definition for its `<commandset>` and index commands
   * by name. Called once during component connect.
   *
   * Commands declaring a `shortcut="ctrl+s"` (etc) get a global keydown
   * listener installed against the host element. Shortcut grammar is
   * intentionally tiny: zero or more modifiers from {ctrl, alt, shift,
   * meta} plus a single key, joined by `+`. Matching is
   * case-insensitive on the key.
   */
  language.setupCommands = instance => {
    instance.commands = new Map();
    const commandset = language.firstChildElement(instance.definition, 'commandset');
    if (!commandset) return;
    for (const command of language.childElements(commandset, 'command')) {
      instance.commands.set(command.getAttribute('name'), command);
    }
    installCommandShortcuts(instance);
  };

  /**
   * Wire up `shortcut="ctrl+s"` keybindings. The listener lives on
   * `document` so the shortcut works no matter where focus is. We only
   * install one listener per instance; it dispatches to the correct
   * command by walking the indexed map. Listener is collected on
   * instance.scope so it's removed at unmount.
   */
  function installCommandShortcuts(instance) {
    const entries = [];
    for (const [name, command] of instance.commands) {
      const shortcut = command.getAttribute('shortcut');
      if (shortcut) entries.push({ name, combo: parseShortcut(shortcut) });
    }
    if (entries.length === 0) return;

    const handler = event => {
      // Don't poach typing in editable controls unless the shortcut is
      // explicitly modifier-bearing (Ctrl/Cmd/Alt). Plain alphanumeric
      // shortcuts would be hostile in an <input>.
      const target = event.target;
      const editable =
        target?.isContentEditable ||
        target?.matches?.('input, textarea, select');
      for (const entry of entries) {
        if (!matches(entry.combo, event)) continue;
        if (editable && !(entry.combo.ctrl || entry.combo.meta || entry.combo.alt)) continue;
        event.preventDefault();
        language.executeCommand(instance, entry.name, {}, event);
        return;
      }
    };
    document.addEventListener('keydown', handler);
    instance.scope.collect(() =>
      document.removeEventListener('keydown', handler),
    );
  }

  function parseShortcut(spec) {
    const parts = String(spec).toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
    const combo = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
    for (const part of parts) {
      if (part === 'ctrl' || part === 'control') combo.ctrl = true;
      else if (part === 'alt' || part === 'option') combo.alt = true;
      else if (part === 'shift') combo.shift = true;
      else if (part === 'meta' || part === 'cmd' || part === 'command') combo.meta = true;
      else combo.key = part;
    }
    return combo;
  }

  function matches(combo, event) {
    if (Boolean(event.ctrlKey) !== combo.ctrl) return false;
    if (Boolean(event.altKey) !== combo.alt) return false;
    if (Boolean(event.shiftKey) !== combo.shift) return false;
    if (Boolean(event.metaKey) !== combo.meta) return false;
    return String(event.key || '').toLowerCase() === combo.key;
  }

  /**
   * `true` if the command has no `enabled` attribute, otherwise the value
   * of evaluating that expression against the current scope.
   */
  language.commandEnabled = (instance, name, local = {}) => {
    const command = instance.commands?.get(name);
    if (!command) return false;
    const expression = command.getAttribute('enabled');
    return expression ? Boolean(language.evaluate(expression, instance, local)) : true;
  };

  /**
   * Execute the command. Silently no-ops when the command is missing OR
   * disabled (so a user double-click on a disabled button can't sneak
   * through a stale handler).
   */
  language.executeCommand = (instance, name, local = {}, event = null) => {
    const command = instance.commands?.get(name);
    if (!command || !language.commandEnabled(instance, name, local)) return;
    language.runOperations([...command.children], instance, local, event);
  };
}
