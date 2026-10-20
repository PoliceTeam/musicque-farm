/** Prefix browser URLs for public files; Next Link/router already apply basePath themselves. */
export function publicPath(path: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string {
  return `${basePath.replace(/\/$/, '')}${path}`;
}

export function realtimeUrl(apiUrl: string, pageUrl: string): string {
  const url = new URL(`${apiUrl.replace(/\/$/, '')}/ws`, pageUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/** Convert an actual browser URL path to a Next route; undefined belongs to another app. */
export function routePath(path: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): string | undefined {
  const base = basePath.replace(/\/$/, '');
  if (!base) return path;
  if (path.split(/[?#]/, 1)[0] === base) return `/${path.slice(base.length)}`;
  return path.startsWith(`${base}/`) ? path.slice(base.length) : undefined;
}
