import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await check(path); continue; }
    if (!/\.(js|mjs)$/.test(entry.name)) continue;
    const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
for (const directory of ['public', 'tests', 'scripts', 'supabase/functions']) await check(directory);
const result = spawnSync(process.execPath, ['--check', 'server.js'], { stdio: 'inherit' });
process.exitCode = result.status || 0;
