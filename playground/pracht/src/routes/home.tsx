import { Link } from '@pracht/core';
import { useEffect, useState } from 'preact/hooks';

export function Component() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <section>
      <h1 data-hydrated={String(hydrated)}>pracht + Void</h1>
      <Link route="smoke">Smoke</Link>
    </section>
  );
}
