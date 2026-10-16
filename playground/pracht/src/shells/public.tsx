import type { ShellProps } from '@pracht/core';

export function Shell({ children }: ShellProps) {
  return <main>{children}</main>;
}

export function head() {
  return { lang: 'en', title: 'pracht + Void' };
}
