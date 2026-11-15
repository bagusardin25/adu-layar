import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

// One React root per page, reused when a module is hot-reloaded during local development.
const roots = new WeakMap<Element, Root>();

export function mount(node: ReactNode): void {
  const el = document.getElementById('root');
  if (!el) throw new Error('The page has no #root element.');
  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  root.render(<StrictMode>{node}</StrictMode>);
}
