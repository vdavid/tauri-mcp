// Console capture script - injected into webview on load
// Captures console.log, warn, error, debug, info and stores in memory
(function() {
  'use strict';

  if (window.__tauriMcpConsole) return; // Already initialized

  const maxEntries = 1000;
  const logs = [];

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
  };

  function captureLog(level, args) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: Array.from(args).map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch {
          return String(arg);
        }
      }).join(' '),
    };

    logs.push(entry);
    if (logs.length > maxEntries) {
      logs.shift();
    }
  }

  console.log = (...args) => { captureLog('log', args); originalConsole.log(...args); };
  console.warn = (...args) => { captureLog('warn', args); originalConsole.warn(...args); };
  console.error = (...args) => { captureLog('error', args); originalConsole.error(...args); };
  console.debug = (...args) => { captureLog('debug', args); originalConsole.debug(...args); };
  console.info = (...args) => { captureLog('info', args); originalConsole.info(...args); };

  window.__tauriMcpConsole = {
    getLogs: (filter, since) => {
      let result = logs;

      if (since) {
        const sinceDate = new Date(since);
        result = result.filter(entry => new Date(entry.timestamp) > sinceDate);
      }

      if (filter) {
        const regex = new RegExp(filter);
        result = result.filter(entry => regex.test(entry.message));
      }

      return result;
    },
    clear: () => { logs.length = 0; },
  };
})();
