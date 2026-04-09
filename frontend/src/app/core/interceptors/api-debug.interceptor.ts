import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const apiDebugInterceptor: HttpInterceptorFn = (request, next) => {
  const start = performance.now();

  return next(request).pipe(
    catchError((error: unknown) => {
      const duration = Math.round(performance.now() - start);
      if (error instanceof HttpErrorResponse) {
        const details = {
          method: request.method,
          url: request.url,
          status: error.status,
          statusText: error.statusText,
          durationMs: duration,
          error: error.error
        };

        console.error('[INSPIRE API ERROR]', details);
      } else {
        console.error('[INSPIRE API ERROR]', {
          method: request.method,
          url: request.url,
          durationMs: duration,
          error
        });
      }

      return throwError(() => error);
    })
  );
};
