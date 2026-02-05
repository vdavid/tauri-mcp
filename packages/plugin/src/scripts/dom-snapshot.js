// DOM snapshot script for capturing accessibility tree or structure tree
window.__tauriMcpDomSnapshot = function(type, selector) {
  'use strict';

  const root = selector ? document.querySelector(selector) : document.body;
  if (!root) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (type === 'accessibility') {
    return captureAccessibilityTree(root);
  } else if (type === 'structure') {
    return captureStructureTree(root);
  } else {
    throw new Error(`Unknown snapshot type: ${type}. Use 'accessibility' or 'structure'.`);
  }

  function captureAccessibilityTree(element) {
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

    return formatAccessibilityAsYaml(result);
  }

  function formatAccessibilityAsYaml(items) {
    if (items.length === 0) return '';

    const lines = [];
    for (const item of items) {
      lines.push(`- tag: ${item.tag}`);
      if (item.role) lines.push(`  role: ${item.role}`);
      if (item.name) lines.push(`  name: ${yamlEscape(item.name)}`);
      if (item.value !== undefined) lines.push(`  value: ${yamlEscape(item.value)}`);
      if (item.disabled) lines.push(`  disabled: true`);
      if (item.checked) lines.push(`  checked: true`);
      if (item.selected) lines.push(`  selected: true`);
      if (item.expanded !== undefined) lines.push(`  expanded: ${item.expanded}`);
      if (item.pressed !== undefined) lines.push(`  pressed: ${item.pressed}`);
      if (item.selector) lines.push(`  selector: ${yamlEscapeSelector(item.selector)}`);
    }
    return lines.join('\n');
  }

  function yamlEscape(value) {
    if (value === '') return '""';
    if (value === null || value === undefined) return '""';
    const str = String(value);
    // Quote if contains special YAML characters or starts/ends with whitespace
    if (/[:\[\]{}#&*!|>'"%@`]/.test(str) || /^\s|\s$/.test(str) || str.includes('\n')) {
      return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    }
    return str;
  }

  function yamlEscapeSelector(selector) {
    // Selectors often contain special chars like >, :, #, etc.
    if (/[>\s:\[\]#.]/.test(selector)) {
      return '"' + selector.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return selector;
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
    return formatStructureTree(element, '', true);
  }

  function formatStructureTree(element, prefix, isLast, depth = 0) {
    if (depth > 20) return ''; // Prevent infinite recursion

    const lines = [];
    const nodeStr = formatNodeString(element);

    if (depth === 0) {
      // Root element has no prefix
      lines.push(nodeStr);
    } else {
      const connector = isLast ? '└─ ' : '├─ ';
      lines.push(prefix + connector + nodeStr);
    }

    const children = Array.from(element.children);
    const childCount = children.length;

    for (let i = 0; i < childCount; i++) {
      const child = children[i];
      const isLastChild = i === childCount - 1;
      let childPrefix;

      if (depth === 0) {
        childPrefix = '';
      } else {
        childPrefix = prefix + (isLast ? '   ' : '│  ');
      }

      const childLines = formatStructureTree(child, childPrefix, isLastChild, depth + 1);
      if (childLines) {
        lines.push(childLines);
      }
    }

    return lines.join('\n');
  }

  function formatNodeString(element) {
    let str = element.tagName.toLowerCase();

    // Add class (first class only for brevity, or all classes joined by dots)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        str += '.' + classes.join('.');
      }
    }

    // Add id
    if (element.id) {
      str += '#' + element.id;
    }

    // Add data-testid
    if (element.dataset.testid) {
      str += ' @' + element.dataset.testid;
    }

    return str;
  }

  function escapeCssIdentifier(id) {
    // Use CSS.escape if available, otherwise implement a simple escaper
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(id);
    }
    // Simple escaper for special characters in CSS identifiers
    return id.replace(/([^\w-])/g, '\\$1');
  }

  function getUniqueSelector(element) {
    if (element.id) {
      return '#' + escapeCssIdentifier(element.id);
    }
    if (element.dataset.testid) {
      return `[data-testid="${element.dataset.testid}"]`;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift('#' + escapeCssIdentifier(current.id));
        break;
      }

      // Add class if available for more specific selection
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(Boolean);
        if (classes.length > 0) {
          selector += '.' + classes.map(escapeCssIdentifier).join('.');
        }
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
