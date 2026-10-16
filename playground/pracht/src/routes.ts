import { defineApp, route } from '@pracht/core';

export const app = defineApp({
  shells: {
    public: './shells/public.tsx',
  },
  routes: [
    route('/', './routes/home.tsx', { id: 'home', render: 'ssg', shell: 'public' }),
    route('/about', './routes/about.tsx', { id: 'about', render: 'ssg', shell: 'public' }),
    route('/smoke', './routes/smoke.tsx', { id: 'smoke', render: 'ssr', shell: 'public' }),
  ],
  notFound: {
    component: './routes/not-found.tsx',
    shell: 'public',
  },
});
