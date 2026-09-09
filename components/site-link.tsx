import type { ComponentProps } from 'react';

// GitHub Pages serves complete HTML documents. Native links avoid requesting
// server-rendered navigation payloads from a host that only serves static files.
export default function SiteLink(props: ComponentProps<'a'>) {
  return <a {...props}/>;
}
