import { setScrollLock } from '../util.js';

/* =============================================================================
   overlays.js — one place that owns open/close behaviour for every surface
   Handles: focus trapping, Escape, backdrop clicks, scroll locking, and
   returning focus to where the user was.
   ========================================================================== */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

class OverlayManager {
  constructor() {
    this.stack = [];
    this.onChange = () => {};
    document.addEventListener('keydown', (event) => this.handleKeydown(event));
  }

  /** @param {HTMLElement} el the overlay or drawer root */
  open(el, { onClose = null, id = el.id } = {}) {
    if (!el || this.stack.some((entry) => entry.el === el)) return;
    // A token tells stale close/reopen animation timers apart.
    const token = String(Number(el.dataset.overlayToken || 0) + 1);
    el.dataset.overlayToken = token;
    const entry = {
      el,
      id,
      token,
      onClose,
      previousFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    this.stack.push(entry);

    el.hidden = false;
    el.removeAttribute('aria-hidden');
    // Two frames so the element paints before transitions begin.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.stack.some((item) => item.el === el && item.token === token)) {
        el.classList.remove('is-closing');
      }
    }));
    setScrollLock('overlays', true);

    const focusTarget =
      el.querySelector('[data-autofocus]') ||
      el.querySelector('.modal, .drawer')?.querySelector('input, textarea') ||
      el.querySelector('.modal, .drawer') ||
      el;
    if (focusTarget) {
      if (!focusTarget.hasAttribute('tabindex') && !/input|textarea|select|button/i.test(focusTarget.tagName)) {
        focusTarget.setAttribute('tabindex', '-1');
      }
      requestAnimationFrame(() => focusTarget.focus?.({ preventScroll: true }));
    }

    this.onChange(this);
    this.syncBody();
  }

  close(el, { immediate = false } = {}) {
    const index = this.stack.findIndex((entry) => entry.el === el);
    if (index === -1) return;
    const [entry] = this.stack.splice(index, 1);
    entry.el.classList.add('is-closing');

    const finish = () => {
      // A newer open() invalidates this close animation.
      if (entry.el.dataset.overlayToken !== entry.token) return;
      if (this.stack.some((item) => item.el === entry.el)) return;
      entry.el.hidden = true;
      entry.el.classList.remove('is-closing');
    };
    if (immediate) finish();
    else setTimeout(finish, 220);

    const top = this.top;
    if (top) {
      const target = top.el.querySelector('[data-autofocus]')
        || top.el.querySelector('.modal, .drawer')
        || top.el;
      target?.focus?.({ preventScroll: true });
    } else if (entry.previousFocus && document.contains(entry.previousFocus)) {
      entry.previousFocus.focus?.({ preventScroll: true });
    }
    this.syncBody();
    entry.onClose?.();
    this.onChange(this);
  }

  closeTop() {
    const top = this.stack[this.stack.length - 1];
    if (top) {
      this.close(top.el);
      return true;
    }
    return false;
  }

  closeAll() {
    while (this.stack.length) this.closeTop();
  }

  isOpen(el) {
    return this.stack.some((entry) => entry.el === el);
  }

  get top() {
    return this.stack[this.stack.length - 1] || null;
  }

  syncBody() {
    setScrollLock('overlays', this.stack.length > 0);
  }

  handleKeydown(event) {
    const top = this.top;
    if (!top) return;

    if (event.key === 'Escape') {
      // stopPropagation alone does not stop other listeners on `document`;
      // this one Escape must close exactly the top surface.
      event.stopImmediatePropagation();
      event.preventDefault();
      this.closeTop();
      return;
    }

    if (event.key !== 'Tab') return;
    const nodes = Array.from(top.el.querySelectorAll(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement,
    );
    if (!nodes.length) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || !top.el.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

export const overlays = new OverlayManager();

/** Wire the standard close buttons inside an overlay. */
export function wireOverlay(el) {
  el.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => overlays.close(el));
  });
  // `click` includes touch and pen activation; `mousedown` did not.
  el.addEventListener('click', (event) => {
    if (event.target === el) overlays.close(el);
  });
  return el;
}
