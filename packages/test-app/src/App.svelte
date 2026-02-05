<script lang="ts">
  interface Todo {
    id: number;
    text: string;
    completed: boolean;
  }

  let todos = $state<Todo[]>([]);
  let newTodoText = $state("");
  let isLoading = $state(false);
  let loadingMessage = $state("");

  let nextId = 1;

  const simulateDelay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const addTodo = async () => {
    const text = newTodoText.trim();
    if (!text) return;

    isLoading = true;
    loadingMessage = "Adding todo...";

    // Simulate async API call
    await simulateDelay(500);

    todos = [...todos, { id: nextId++, text, completed: false }];
    newTodoText = "";
    isLoading = false;
    loadingMessage = "";
  };

  const toggleTodo = async (id: number) => {
    isLoading = true;
    loadingMessage = "Updating...";

    // Simulate async API call
    await simulateDelay(300);

    todos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    isLoading = false;
    loadingMessage = "";
  };

  const deleteTodo = async (id: number) => {
    isLoading = true;
    loadingMessage = "Deleting...";

    // Simulate async API call
    await simulateDelay(300);

    todos = todos.filter((todo) => todo.id !== id);
    isLoading = false;
    loadingMessage = "";
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      addTodo();
    }
  };

  const openAboutWindow = () => {
    // Use Tauri's global API if available
    const tauri = (window as { __TAURI__?: { webviewWindow?: { WebviewWindow: { new(label: string, options?: { url?: string; title?: string; width?: number; height?: number }): unknown } } } }).__TAURI__;
    if (tauri?.webviewWindow?.WebviewWindow) {
      new tauri.webviewWindow.WebviewWindow("about", {
        url: "about.html",
        title: "About",
        width: 400,
        height: 300,
      });
    } else {
      // Fallback for dev mode
      window.open("/about.html", "_blank", "width=400,height=300");
    }
  };
</script>

<main data-testid="app-container">
  <header>
    <h1>Todo list</h1>
    <button
      type="button"
      onclick={openAboutWindow}
      class="about-btn"
      data-testid="about-button"
      aria-label="Open about window"
    >
      About
    </button>
  </header>

  <div class="input-row">
    <input
      type="text"
      bind:value={newTodoText}
      onkeydown={handleKeydown}
      placeholder="Example: Buy groceries"
      disabled={isLoading}
      data-testid="todo-input"
      aria-label="New todo text"
    />
    <button
      type="button"
      onclick={addTodo}
      disabled={isLoading || !newTodoText.trim()}
      data-testid="add-button"
    >
      Add
    </button>
  </div>

  {#if isLoading}
    <p class="loading" data-testid="loading-indicator" aria-live="polite">
      {loadingMessage}
    </p>
  {/if}

  {#if todos.length === 0}
    <p class="empty" data-testid="empty-message">No todos yet. Add one above!</p>
  {:else}
    <ul class="todo-list" data-testid="todo-list" aria-label="Todo items">
      {#each todos as todo (todo.id)}
        <li class:completed={todo.completed} data-testid="todo-item">
          <label class="todo-label">
            <input
              type="checkbox"
              checked={todo.completed}
              onchange={() => toggleTodo(todo.id)}
              disabled={isLoading}
              data-testid="todo-checkbox"
              aria-label={`Mark "${todo.text}" as ${todo.completed ? "incomplete" : "complete"}`}
            />
            <span class="todo-text" data-testid="todo-text">{todo.text}</span>
          </label>
          <button
            type="button"
            onclick={() => deleteTodo(todo.id)}
            disabled={isLoading}
            class="delete-btn"
            data-testid="delete-button"
            aria-label={`Delete "${todo.text}"`}
          >
            Delete
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <footer>
    <p data-testid="todo-count">
      {todos.length} {todos.length === 1 ? "item" : "items"} total,
      {todos.filter((t) => t.completed).length} completed
    </p>
  </footer>
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
    max-width: 500px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .about-btn {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .about-btn:hover {
    background-color: #f3f4f6;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  input[type="text"] {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 1rem;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  button {
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  button:hover:not(:disabled) {
    background-color: #2563eb;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .empty {
    color: #9ca3af;
    text-align: center;
    padding: 2rem;
  }

  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .todo-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    background-color: white;
  }

  .todo-list li.completed {
    background-color: #f9fafb;
  }

  .todo-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    cursor: pointer;
  }

  .todo-text {
    flex: 1;
  }

  .completed .todo-text {
    text-decoration: line-through;
    color: #9ca3af;
  }

  .delete-btn {
    background-color: #ef4444;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  .delete-btn:hover:not(:disabled) {
    background-color: #dc2626;
  }

  footer {
    margin-top: 1.5rem;
    text-align: center;
  }

  footer p {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }
</style>
