const CUSTOM_ELEMENT_NAME = /^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/;

class InspectoidStoryHost extends HTMLElement {
  static get observedAttributes() {
    return ['story-tag'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'story-tag' && oldValue !== newValue) this.render();
  }

  render() {
    const tag = (this.getAttribute('story-tag') || '').trim();
    this.replaceChildren();

    if (!tag) {
      this.append(statusMessage('No story selected.'));
      return;
    }

    if (!CUSTOM_ELEMENT_NAME.test(tag)) {
      this.append(statusMessage(`Invalid component tag: ${tag}`));
      return;
    }

    this.append(document.createElement(tag));
  }
}

function statusMessage(text) {
  const message = document.createElement('div');
  message.className = 'alert alert-warning mb-0';
  message.textContent = text;
  return message;
}

if (!customElements.get('inspectoid-story-host')) {
  customElements.define('inspectoid-story-host', InspectoidStoryHost);
}
