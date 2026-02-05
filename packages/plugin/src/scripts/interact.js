// UI interaction script for click, type, scroll operations
window.__tauriMcpInteract = function(args) {
  'use strict';

  const { action, selector, x, y, text, scrollX, scrollY } = args;

  // Find target element
  let element = null;
  if (selector) {
    element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
  } else if (x !== undefined && y !== undefined) {
    element = document.elementFromPoint(x, y);
    if (!element) {
      throw new Error(`No element at coordinates (${x}, ${y})`);
    }
  }

  switch (action) {
    case 'click':
      return doClick(element, x, y, false);

    case 'double_click':
      return doClick(element, x, y, true);

    case 'type':
      return doType(element, text);

    case 'scroll':
      return doScroll(element, scrollX, scrollY);

    default:
      throw new Error(`Unknown action: ${action}. Use 'click', 'double_click', 'type', or 'scroll'.`);
  }

  function doClick(el, clientX, clientY, isDouble) {
    if (!el) {
      throw new Error("No element specified for click. Provide 'selector' or 'x'/'y' coordinates.");
    }

    // Check if element is visible and clickable
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error(`Element is not visible (zero size): ${getElementDescription(el)}`);
    }

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      throw new Error(`Element is hidden: ${getElementDescription(el)}`);
    }

    if (style.pointerEvents === 'none') {
      throw new Error(`Element has pointer-events: none: ${getElementDescription(el)}`);
    }

    // Calculate click position
    const clickX = clientX ?? (rect.left + rect.width / 2);
    const clickY = clientY ?? (rect.top + rect.height / 2);

    // Create and dispatch events
    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: clickX,
      clientY: clickY,
      button: 0,
    };

    el.dispatchEvent(new MouseEvent('mousedown', eventInit));
    el.dispatchEvent(new MouseEvent('mouseup', eventInit));
    el.dispatchEvent(new MouseEvent('click', eventInit));

    if (isDouble) {
      el.dispatchEvent(new MouseEvent('dblclick', eventInit));
    }

    // Focus if focusable
    if (typeof el.focus === 'function') {
      el.focus();
    }

    const actionType = isDouble ? 'Double-clicked' : 'Clicked';
    return { success: true, message: `${actionType} ${getElementDescription(el)}` };
  }

  function doType(el, inputText) {
    if (!el) {
      throw new Error("No element specified for type. Provide 'selector'.");
    }

    if (!inputText) {
      throw new Error("Missing 'text' argument for type action.");
    }

    // Check if element accepts input
    const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const isContentEditable = el.contentEditable === 'true';

    if (!isInput && !isContentEditable) {
      throw new Error(`Element does not accept text input: ${getElementDescription(el)}`);
    }

    // Check if element is disabled or readonly
    if (el.disabled) {
      throw new Error(`Element is disabled: ${getElementDescription(el)}`);
    }
    if (el.readOnly) {
      throw new Error(`Element is read-only: ${getElementDescription(el)}`);
    }

    // Check for input types that don't accept text
    if (el.tagName === 'INPUT') {
      const nonTextTypes = ['checkbox', 'radio', 'file', 'submit', 'reset', 'button', 'image', 'hidden', 'range', 'color'];
      if (nonTextTypes.includes(el.type)) {
        throw new Error(`Input type '${el.type}' does not accept text: ${getElementDescription(el)}`);
      }
    }

    // Focus the element
    el.focus();

    if (isInput) {
      // Clear existing value and set new one
      el.value = inputText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Content editable
      el.textContent = inputText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const truncated = inputText.slice(0, 20);
    return { success: true, message: `Typed "${truncated}${inputText.length > 20 ? '...' : ''}" into ${getElementDescription(el)}` };
  }

  function doScroll(el, deltaX, deltaY) {
    const target = el || document.documentElement;

    if (deltaX === undefined && deltaY === undefined) {
      throw new Error("Missing 'scrollX' or 'scrollY' argument for scroll action.");
    }

    target.scrollBy({
      left: deltaX || 0,
      top: deltaY || 0,
      behavior: 'smooth'
    });

    return {
      success: true,
      message: `Scrolled ${el ? getElementDescription(el) : 'page'} by (${deltaX || 0}, ${deltaY || 0})`
    };
  }

  function getElementDescription(el) {
    if (el.id) return `#${el.id}`;
    if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;

    let desc = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass) desc += `.${firstClass}`;
    }

    const textContent = el.innerText?.trim();
    if (textContent) {
      const truncated = textContent.slice(0, 20);
      desc += ` "${truncated}${textContent.length > 20 ? '...' : ''}"`;
    }

    return desc;
  }
};
