import { HttpInterceptorFn } from '@angular/common/http';

function getApiBaseFromUrl(): string {
  const apiBaseParam = new URL(globalThis.location.href).searchParams.get('inspireApiBase');
  return typeof apiBaseParam === 'string' ? apiBaseParam.replace(/\/$/, '') : '';
}

function getNormalizedDesktopBase(): string {
  const desktopApiBase = (globalThis as { inspireDesktop?: { apiBase?: string } }).inspireDesktop?.apiBase;
  if (typeof desktopApiBase === 'string' && desktopApiBase.trim()) {
    return desktopApiBase.replace(/\/$/, '');
  }

  return getApiBaseFromUrl();
}

export const desktopApiInterceptor: HttpInterceptorFn = (request, next) => {
  const normalizedBase = getNormalizedDesktopBase();

  if (!normalizedBase || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(request.clone({
    url: `${normalizedBase}${request.url}`
  }));
};
