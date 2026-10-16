import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import spawn from 'cross-spawn';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { collectBrowserDiagnostics } from '../../../../test/browser-helpers.ts';
import { killChild, startServer } from '../../../../test/integration-helpers.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PLAYGROUND = 'playground/pracht';
let DEV_BASE: string;

describe(
  'playground/pracht dev',
  () => {
    let child: ReturnType<typeof spawn>;
    let serverOutput = () => '';

    beforeAll(
      async () => {
        const pg = join(ROOT, PLAYGROUND);
        rmSync(join(pg, '.void'), { recursive: true, force: true });
        rmSync(join(pg, '.wrangler'), { recursive: true, force: true });

        const server = await startServer(
          (port) => {
            child = spawn(
              'vp',
              ['run', '--filter', `./${PLAYGROUND}`, 'dev', '--port', String(port)],
              {
                cwd: ROOT,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, VOID_INSPECTOR_PORT: 'false' },
              },
            );
            return child;
          },
          30_000,
          { expectStatus: 200, expectBody: 'pracht + Void' },
        );
        DEV_BASE = server.base;
        serverOutput = server.output;
      },
      process.platform === 'win32' ? 120_000 : 45_000,
    );

    afterAll(async () => {
      if (child) {
        await killChild(child);
      }
    });

    it('syncs the generated Cloudflare config with bindings from void.config.ts', () => {
      const wranglerConfig = JSON.parse(
        readFileSync(join(ROOT, `${PLAYGROUND}/.void-wrangler.jsonc`), 'utf-8'),
      ) as {
        d1_databases?: Array<{ binding: string }>;
        kv_namespaces?: Array<{ binding: string }>;
      };

      expect(wranglerConfig.d1_databases?.some((b) => b.binding === 'DB')).toBe(true);
      expect(wranglerConfig.kv_namespaces?.some((b) => b.binding === 'KV')).toBe(true);
      expect(existsSync(join(ROOT, `${PLAYGROUND}/wrangler.jsonc`))).toBe(false);
    });

    it('serves void/db and void/kv to loaders and API routes', async () => {
      const page = await fetch(`${DEV_BASE}/smoke`);
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('data-testid="d1-user">Alice');
      expect(html).toContain('data-testid="kv-value">ok');

      const api = await fetch(`${DEV_BASE}/api/smoke`);
      expect(await api.json()).toEqual({ firstUser: { name: 'Alice' } });
    });

    it('runs cron handlers through the dev trigger without serving its token', async () => {
      const pg = join(ROOT, PLAYGROUND);
      const token = readFileSync(join(pg, '.void/dev-trigger-token'), 'utf8').trim();

      const trigger = await fetch(`${DEV_BASE}/__void/scheduled`, {
        method: 'POST',
        headers: { 'x-void-dev-trigger': token },
        body: JSON.stringify({ cron: '0 * * * *', scheduledTime: Date.now() }),
      });
      expect(trigger.status).toBe(200);

      for (const path of ['/.void/dev-trigger-token', '/.void/dev-triggers.ts']) {
        const response = await fetch(`${DEV_BASE}${path}`);
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain(token);
      }
    });

    it('navigates to the smoke route on the client', async () => {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      let diagnostics = () => '';
      try {
        const page = await browser.newPage();
        diagnostics = collectBrowserDiagnostics(page);
        await page.goto(DEV_BASE);
        await page.waitForSelector('h1[data-hydrated="true"]');
        await page.evaluate(() => {
          (window as Window & { __spa_marker?: boolean }).__spa_marker = true;
        });

        await page.click('a[href="/smoke"]');
        await page.waitForURL('**/smoke');
        await page.waitForSelector('[data-testid="d1-user"]');

        const spaMarker = await page.evaluate(
          () => (window as Window & { __spa_marker?: boolean }).__spa_marker,
        );
        expect(spaMarker).toBe(true);
        expect(await page.textContent('[data-testid="d1-user"]')).toBe('Alice');
        expect(await page.textContent('[data-testid="kv-value"]')).toBe('ok');
      } catch (error) {
        throw new Error(`${diagnostics()}\nDev server:\n${serverOutput()}`, { cause: error });
      } finally {
        await browser.close();
      }
    });
  },
  process.platform === 'win32' ? 120_000 : 60_000,
);

describe(
  'playground/pracht build',
  () => {
    it('emits the Worker entry and prerendered pages that void deploy uses', () => {
      const pg = join(ROOT, PLAYGROUND);
      rmSync(join(pg, 'dist'), { recursive: true, force: true });
      const result = spawn.sync('vp', ['run', '--filter', `./${PLAYGROUND}`, 'build'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

      const worker = readFileSync(join(pg, 'dist/server/worker.js'), 'utf8');
      expect(worker).toMatch(/\bdefault\b/);
      expect(worker).not.toMatch(/export\s*{[^}]*\b(buildTarget|resolvedApp)\b/);
      expect(existsSync(join(pg, 'dist/client/index.html'))).toBe(true);
      expect(existsSync(join(pg, 'dist/client/about/index.html'))).toBe(true);
      const serverCode = readdirSync(join(pg, 'dist/server'), { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.js'))
        .map((file) => readFileSync(join(pg, 'dist/server', file), 'utf8'))
        .join('\n');
      expect(serverCode).toContain('Cloudflare env is unavailable');
    });
  },
  process.platform === 'win32' ? 180_000 : 90_000,
);
