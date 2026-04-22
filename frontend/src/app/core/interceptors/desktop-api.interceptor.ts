import { HttpInterceptorFn } from '@angular/common/http';

const desktopApiBase = (globalThis as { inspireDesktop?: { apiBase?: string } }).inspireDesktop?.apiBase;
const normalizedBase = typeof desktopApiBase === 'string' ? desktopApiBase.replace(/\/$/, '') : '';

export const desktopApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!normalizedBase || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(request.clone({
    url: `${normalizedBase}${request.url}`
  }));
};
