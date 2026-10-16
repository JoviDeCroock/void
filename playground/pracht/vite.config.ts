import { cloudflareAdapter } from '@pracht/adapter-cloudflare';
import { pracht } from '@pracht/vite-plugin';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';

export default defineConfig({
  plugins: [
    voidPlugin(),
    pracht({ adapter: cloudflareAdapter({ configPath: './.void-wrangler.jsonc' }) }),
  ],
  // `pracht dev` has no host flag; the integration tests reach the server on 127.0.0.1.
  server: { host: '127.0.0.1' },
});
