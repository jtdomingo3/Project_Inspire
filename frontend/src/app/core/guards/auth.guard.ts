import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isPublic = route.data?.['public'] === true;

  if (isPublic || auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard'], { queryParams: { redirect: state.url } });
};
