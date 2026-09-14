import fs from 'node:fs';
import path from 'node:path';

const stateFile = path.resolve(__dirname, '.state', 'api.json');

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(stateFile)) return;

  const { pid, tmp } = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as { pid: number; tmp: string };

  try {
    // Negative pid = kill the whole process group (see global-setup's detached spawn).
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }

  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(stateFile, { force: true });
}
