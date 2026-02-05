// Wait-for script for waiting on conditions
window.__tauriMcpWaitFor = async function(args) {
  'use strict';

  const { type, value, timeout = 5000 } = args;

  if (!type) {
    throw new Error("Missing 'type' argument. Use 'selector', 'text', 'visible', or 'hidden'.");
  }

  if (!value) {
    throw new Error("Missing 'value' argument.");
  }

  // Check immediately first - element might already exist
  const immediate = checkCondition(type, value);
  if (immediate.satisfied) {
    return { success: true, message: immediate.message };
  }
  if (immediate.error) {
    throw new Error(immediate.error);
  }

  return new Promise((resolve, reject) => {
    let observer;
    let timeoutId;

    const cleanup = () => {
      if (observer) observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(getTimeoutMessage(type, value, timeout)));
    }, timeout);

    // Set up MutationObserver
    observer = new MutationObserver(() => {
      const result = checkCondition(type, value);
      if (result.satisfied) {
        cleanup();
        resolve({ success: true, message: result.message });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: type === 'text'
    });
  });

  function getTimeoutMessage(conditionType, conditionValue, timeoutMs) {
    switch (conditionType) {
      case 'selector':
        return `Timeout after ${timeoutMs}ms waiting for '${conditionValue}' to appear`;
      case 'text':
        return `Timeout after ${timeoutMs}ms waiting for text '${conditionValue}' to appear`;
      case 'visible':
        return `Timeout after ${timeoutMs}ms waiting for '${conditionValue}' to become visible`;
      case 'hidden':
        return `Timeout after ${timeoutMs}ms waiting for '${conditionValue}' to disappear`;
      default:
        return `Timeout after ${timeoutMs}ms waiting for ${conditionType}: ${conditionValue}`;
    }
  }

  function checkCondition(conditionType, conditionValue) {
    switch (conditionType) {
      case 'selector': {
        const el = document.querySelector(conditionValue);
        if (el) {
          return { satisfied: true, message: `Found element matching '${conditionValue}'` };
        }
        return { satisfied: false };
      }

      case 'text': {
        const found = document.body.innerText.includes(conditionValue);
        if (found) {
          return { satisfied: true, message: `Found text '${conditionValue}'` };
        }
        return { satisfied: false };
      }

      case 'visible': {
        const el = document.querySelector(conditionValue);
        if (el && isVisible(el)) {
          return { satisfied: true, message: `Element '${conditionValue}' is visible` };
        }
        return { satisfied: false };
      }

      case 'hidden': {
        const el = document.querySelector(conditionValue);
        if (!el || !isVisible(el)) {
          return { satisfied: true, message: `Element '${conditionValue}' is hidden or removed` };
        }
        return { satisfied: false };
      }

      default:
        return { satisfied: false, error: `Unknown wait type '${conditionType}'. Use 'selector', 'text', 'visible', or 'hidden'.` };
    }
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    return true;
  }
};
