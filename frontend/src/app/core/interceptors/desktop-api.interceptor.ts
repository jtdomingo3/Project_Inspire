import { HttpInterceptorFn } from '@angular/common/http';

const DEFAULT_EMBEDDED_PORT = 3002;

let cachedApiBase: string | null = null;

function resolveApiBase(): string {
  if (cachedApiBase !== null) {
    return cachedApiBase;
  }

  // 1. Try preload bridge (contextBridge.exposeInMainWorld)
  const desktopApiBase = (globalThis as { inspireDesktop?: { apiBase?: string } }).inspireDesktop?.apiBase;
  if (typeof desktopApiBase === 'string' && desktopApiBase.trim()) {
    cachedApiBase = desktopApiBase.replace(/\/$/, '');
    return cachedApiBase;
  }

  // 2. Try URL query parameter (passed by Electron loadFile)
  try {
    const apiBaseParam = new URL(globalThis.location.href).searchParams.get('inspireApiBase');
    if (typeof apiBaseParam === 'string' && apiBaseParam.trim()) {
      cachedApiBase = apiBaseParam.replace(/\/$/, '');
      return cachedApiBase;
    }
  } catch {
    // URL parsing can fail for unusual file:// paths
  }

  // 3. Fallback: if running under file:// protocol, use default embedded backend port
  if (typeof globalThis.location?.protocol === 'string' && globalThis.location.protocol === 'file:') {
    cachedApiBase = `http://127.0.0.1:${DEFAULT_EMBEDDED_PORT}`;
    return cachedApiBase;
  }

  // 4. Running in a normal browser (http://), no rewrite needed
  cachedApiBase = '';
  return cachedApiBase;
}

export const desktopApiInterceptor: HttpInterceptorFn = (request, next) => {
  const base = resolveApiBase();

  if (!base || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(request.clone({
    url: `${base}${request.url}`
  }));
};
