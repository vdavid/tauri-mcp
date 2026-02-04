// DOM snapshot script for capturing accessibility tree or structure tree
window.__tauriMcpDomSnapshot = function(type, selector) {
  'use strict';

  const root = selector ? document.querySelector(selector) : document.body;
  if (!root) {
    return { error: `Element not found: ${selector}` };
  }

  if (type === 'accessibility') {
    return captureAccessibilityTree(root);
  } else if (type === 'structure') {
    return captureStructureTree(root);
  } else {
    return { error: `Unknown snapshot type: ${type}. Use 'accessibility' or 'structure'.` };
  }

  function captureAccessibilityTree(element, depth = 0) {
    const result = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Skip hidden elements
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node = walker.currentNode;
    while (node) {
      const info = getAccessibilityInfo(node);
      if (info) {
        result.push(info);
      }
      node = walker.nextNode();
    }

    return result;
  }

  function getAccessibilityInfo(element) {
    const role = element.getAttribute('role') || getImplicitRole(element);
    const name = getAccessibleName(element);
    const value = getAccessibleValue(element);

    if (!role && !name) return null;

    const info = { tag: element.tagName.toLowerCase() };
    if (role) info.role = role;
    if (name) info.name = name;
    if (value !== undefined) info.value = value;

    // Include important states
    if (element.disabled) info.disabled = true;
    if (element.checked) info.checked = true;
    if (element.selected) info.selected = true;
    if (element.getAttribute('aria-expanded')) info.expanded = element.getAttribute('aria-expanded') === 'true';
    if (element.getAttribute('aria-pressed')) info.pressed = element.getAttribute('aria-pressed') === 'true';

    // Include selector for targeting
    info.selector = getUniqueSelector(element);

    return info;
  }

  function getImplicitRole(element) {
    const roleMap = {
      'A': element.href ? 'link' : null,
      'BUTTON': 'button',
      'INPUT': getInputRole(element),
      'SELECT': 'combobox',
      'TEXTAREA': 'textbox',
      'IMG': 'img',
      'NAV': 'navigation',
      'MAIN': 'main',
      'HEADER': 'banner',
      'FOOTER': 'contentinfo',
      'ARTICLE': 'article',
      'ASIDE': 'complementary',
      'SECTION': 'region',
      'FORM': 'form',
      'TABLE': 'table',
      'UL': 'list',
      'OL': 'list',
      'LI': 'listitem',
      'H1': 'heading',
      'H2': 'heading',
      'H3': 'heading',
      'H4': 'heading',
      'H5': 'heading',
      'H6': 'heading',
    };
    return roleMap[element.tagName] || null;
  }

  function getInputRole(input) {
    const typeRoles = {
      'checkbox': 'checkbox',
      'radio': 'radio',
      'range': 'slider',
      'button': 'button',
      'submit': 'button',
      'reset': 'button',
      'search': 'searchbox',
    };
    return typeRoles[input.type] || 'textbox';
  }

  function getAccessibleName(element) {
    return element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') && getLabelledByText(element) ||
      element.getAttribute('alt') ||
      element.getAttribute('title') ||
      element.innerText?.trim().slice(0, 100) ||
      null;
  }

  function getLabelledByText(element) {
    const id = element.getAttribute('aria-labelledby');
    const labelElement = document.getElementById(id);
    return labelElement?.innerText?.trim() || null;
  }

  function getAccessibleValue(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value;
    }
    if (element.tagName === 'SELECT') {
      return element.options[element.selectedIndex]?.text;
    }
    return undefined;
  }

  function captureStructureTree(element) {
    return walkStructure(element);
  }

  function walkStructure(element, depth = 0) {
    if (depth > 20) return null; // Prevent infinite recursion

    const info = {
      tag: element.tagName.toLowerCase(),
    };

    if (element.id) info.id = element.id;
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim();
      if (classes) info.class = classes;
    }
    if (element.dataset.testid) info.testid = element.dataset.testid;

    const children = [];
    for (const child of element.children) {
      const childInfo = walkStructure(child, depth + 1);
      if (childInfo) children.push(childInfo);
    }

    if (children.length > 0) info.children = children;

    return info;
  }

  function getUniqueSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.dataset.testid) return `[data-testid="${element.dataset.testid}"]`;

    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift(`#${current.id}`);
        break;
      }

      const siblings = current.parentElement?.children || [];
      const sameTag = Array.from(siblings).filter(s => s.tagName === current.tagName);

      if (sameTag.length > 1) {
        const index = sameTag.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
};
