import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { LoginResponse } from '../models/inspire-api.models';
import { AuthService } from '../services/auth.service';

export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const http = inject(HttpClient);

  if (request.url.includes('/api/auth/refresh')) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.isAuthenticated()) {
        return throwError(() => error);
      }

      return http.post<LoginResponse>('/api/auth/refresh', {}).pipe(
        switchMap((response) => {
          if (!response.success || !response.token) {
            auth.clearSession();
            return throwError(() => error);
          }

          const retryRequest = request.clone({
            setHeaders: {
              Authorization: `Bearer ${response.token}`
            }
          });
          return next(retryRequest);
        }),
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
