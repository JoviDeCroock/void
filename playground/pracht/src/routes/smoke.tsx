import type { RouteComponentProps } from '@pracht/core';
import { db } from 'void/db';
import { kv } from 'void/kv';
import { users } from '../../db/schema.ts';

export async function loader() {
  const rows = await db.select().from(users).limit(1);
  await kv.put('smoke', 'ok');
  return { user: rows[0]?.name ?? null, kvValue: await kv.get<string>('smoke') };
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  return (
    <section>
      <h1>Smoke</h1>
      <p data-testid="d1-user">{data.user}</p>
      <p data-testid="kv-value">{data.kvValue}</p>
    </section>
  );
}
