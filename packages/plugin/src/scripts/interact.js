// UI interaction script for click, type, scroll operations
window.__tauriMcpInteract = function(args) {
  'use strict';

  const { action, selector, x, y, text, scrollX, scrollY } = args;

  // Find target element
  let element = null;
  if (selector) {
    element = document.querySelector(selector);
    if (!element) {
      return { error: `Element not found: ${selector}` };
    }
  } else if (x !== undefined && y !== undefined) {
    element = document.elementFromPoint(x, y);
    if (!element) {
      return { error: `No element at coordinates (${x}, ${y})` };
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
      return { error: `Unknown action: ${action}. Use 'click', 'double_click', 'type', or 'scroll'.` };
  }

  function doClick(el, clientX, clientY, isDouble) {
    if (!el) {
      return { error: "No element specified for click. Provide 'selector' or 'x'/'y' coordinates." };
    }

    // Check if element is visible and clickable
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { error: `Element is not visible (zero size): ${getElementDescription(el)}` };
    }

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return { error: `Element is hidden: ${getElementDescription(el)}` };
    }

    if (style.pointerEvents === 'none') {
      return { error: `Element has pointer-events: none: ${getElementDescription(el)}` };
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
      return { error: "No element specified for type. Provide 'selector'." };
    }

    if (!inputText) {
      return { error: "Missing 'text' argument for type action." };
    }

    // Check if element accepts input
    const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const isContentEditable = el.contentEditable === 'true';

    if (!isInput && !isContentEditable) {
      return { error: `Element does not accept text input: ${getElementDescription(el)}` };
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

    return { success: true, message: `Typed "${inputText.slice(0, 20)}${inputText.length > 20 ? '...' : ''}" into ${getElementDescription(el)}` };
  }

  function doScroll(el, deltaX, deltaY) {
    const target = el || document.documentElement;

    if (deltaX === undefined && deltaY === undefined) {
      return { error: "Missing 'scrollX' or 'scrollY' argument for scroll action." };
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

    const text = el.innerText?.trim().slice(0, 20);
    if (text) desc += ` "${text}${el.innerText.length > 20 ? '...' : ''}"`;

    return desc;
  }
};
