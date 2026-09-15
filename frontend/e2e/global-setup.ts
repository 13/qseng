import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { SpawnOptions, spawn } from 'node:child_process';

const API_PORT = 5000;
const READY_URL = `http://127.0.0.1:${API_PORT}/health/ready`;
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 500;

// e2e/ -> frontend/ -> repo root -> backend/src/Qseng.Api
const apiProjectDir = path.resolve(__dirname, '../../backend/src/Qseng.Api');
const stateDir = path.resolve(__dirname, '.state');
const stateFile = path.join(stateDir, 'api.json');

/** Rejects if something is already listening on `port` — we refuse to reuse it. */
function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${port} is already in use. The Playwright API global-setup refuses to reuse an ` +
          `existing listener on the proxy target port — stop whatever is bound to :${port} and re-run.`
        ));
      } else {
        reject(err);
      }
    });
    tester.once('listening', () => tester.close(() => resolve()));
    tester.listen(port, '127.0.0.1');
  });
}

async function waitForReady(child: ReturnType<typeof spawn>, log: string[]): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let exited = false;
  child.once('exit', (code, signal) => {
    exited = true;
    log.push(`[api] process exited early (code=${code} signal=${signal})`);
  });

  while (Date.now() < deadline) {
    if (exited) break;
    try {
      const res = await fetch(READY_URL);
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === 'Healthy') return;
      }
    } catch {
      // API not accepting connections yet — keep polling.
    }
    await new Promise(r => setTimeout(r, READY_POLL_MS));
  }

  const tail = log.slice(-60).join('\n');
  throw new Error(
    `API did not become ready at ${READY_URL} within ${READY_TIMEOUT_MS}ms.\n--- last output ---\n${tail}`
  );
}

export default async function globalSetup(): Promise<void> {
  await assertPortFree(API_PORT);

  // Each run spins up a brand-new API instance (fresh tmp SQLite db), so any storage-state
  // cached by fixtures.ts from a previous run (e.g. e2e/.state/demo.json) holds a token for a
  // user/db that no longer exists — stale-but-decodable tokens surface later as background API
  // calls silently failing rather than an obvious redirect. Wipe everything except this run's
  // own api.json (about to be (re)written below) so every run starts with fixtures re-logging in.
  if (fs.existsSync(stateDir)) {
    for (const entry of fs.readdirSync(stateDir)) {
      if (entry === 'api.json') continue;
      fs.rmSync(path.join(stateDir, entry), { recursive: true, force: true });
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qseng-e2e-'));
  const uploadsPath = path.join(tmp, 'uploads');
  fs.mkdirSync(uploadsPath, { recursive: true });

  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: `http://127.0.0.1:${API_PORT}`,
    DB_PROVIDER: 'sqlite',
    CONNECTION_STRING: `Data Source=${path.join(tmp, 'e2e.db')}`,
    Uploads__Path: uploadsPath,
    RateLimiting__Auth__PermitLimit: '1000',
    Cors__AllowedOrigins__0: 'http://localhost:4200'
  };

  // CI passes a prebuilt-dll command (e.g. `dotnet /path/Qseng.Api.dll`); locally we `dotnet run`
  // the project so the first invocation compiles it (~40s).
  const envCmd = process.env['E2E_API_CMD'];

  const log: string[] = [];
  // detached: true makes the child the leader of its own process group, so teardown can
  // kill the whole tree (dotnet run's build/host child included) via a negative pid.
  const spawnOptions: SpawnOptions = { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] };
  // A naive `envCmd.split(' ')` breaks on any path containing a space (e.g. a workspace under
  // "Program Files" or a repo checked out under a name with a space). `shell: true` hands the
  // whole string to the platform shell instead, so quoting-aware parsing (and quoted paths) is
  // the caller's responsibility rather than ours. The no-env-var default has no such risk since
  // its argv is built here, so it keeps the plain (shell-less) array form.
  const child = envCmd
    ? spawn(envCmd, { ...spawnOptions, shell: true })
    : spawn('dotnet', ['run', '--project', apiProjectDir, '--no-launch-profile'], spawnOptions);
  child.stdout?.on('data', d => log.push(String(d)));
  child.stderr?.on('data', d => log.push(String(d)));

  if (typeof child.pid !== 'number') {
    throw new Error('Failed to spawn the API process (no pid).');
  }

  try {
    await waitForReady(child, log);
  } catch (err) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ pid: child.pid, tmp }, null, 2));
}
