import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';
import { apiDebugInterceptor } from './core/interceptors/api-debug.interceptor';
import { desktopApiInterceptor } from './core/interceptors/desktop-api.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([desktopApiInterceptor, authInterceptor, authRefreshInterceptor, apiDebugInterceptor])),
    provideRouter(routes, withHashLocation())
  ]
};
