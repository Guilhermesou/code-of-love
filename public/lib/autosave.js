// Serialize writes and coalesce keystrokes, including edits made during a write.
export function createAutosave({ read, write, onState = () => {}, delay = 350 }) {
  let timer, pending = false, running = null;
  async function drain() {
    if (running) return running;
    running = (async () => {
      while (pending) {
        pending = false;
        try { await write(read()); }
        catch (error) { onState('error', error); return; }
      }
      onState('saved');
    })();
    try { await running; } finally { running = null; }
  }
  return {
    schedule() {
      pending = true;
      onState('saving');
      clearTimeout(timer);
      timer = setTimeout(() => { void drain(); }, delay);
    },
    flush() { clearTimeout(timer); return pending || running ? drain() : Promise.resolve(); },
  };
}
