<script lang="ts">
  let loadTime = $state("");

  // Simulate async operation to get "server" info
  const fetchVersion = async (): Promise<string> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return "0.1.0";
  };

  $effect(() => {
    const now = new Date();
    loadTime = now.toISOString();
  });
</script>

<main data-testid="about-container" aria-label="About window">
  <h1>tauri-mcp test app</h1>

  {#await fetchVersion()}
    <p class="version" data-testid="version">Loading version...</p>
  {:then version}
    <p class="version" data-testid="version">Version {version}</p>
  {/await}

  <p>
    A minimal test application for the
    <a
      href="https://github.com/vdavid/tauri-mcp"
      target="_blank"
      rel="noopener"
      aria-label="tauri-mcp GitHub repository"
    >
      tauri-mcp
    </a>
    MCP server plugin.
  </p>

  <p class="load-time" data-testid="load-time">
    Window opened at: {loadTime}
  </p>
</main>

<style>
  :global(body) {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, sans-serif;
    line-height: 1.5;
    color: #213547;
    background-color: #f8f9fa;
    margin: 0;
    padding: 0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .version {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  p {
    color: #4b5563;
    max-width: 300px;
    margin: 0 0 0.5rem;
  }

  a {
    color: #3b82f6;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .load-time {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 1rem;
  }
</style>
