// Wait-for script for waiting on conditions
window.__tauriMcpWaitFor = async function(args) {
  'use strict';

  const { type, value, timeout = 5000 } = args;

  if (!type) {
    return { error: "Missing 'type' argument. Use 'selector', 'text', 'visible', or 'hidden'." };
  }

  if (!value) {
    return { error: "Missing 'value' argument." };
  }

  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const result = checkCondition(type, value);
    if (result.satisfied) {
      return { success: true, message: result.message };
    }
    await sleep(pollInterval);
  }

  return {
    error: `Timeout after ${timeout}ms waiting for ${type}: ${value}`
  };

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
        return { satisfied: false, error: `Unknown condition type: ${conditionType}` };
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

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
