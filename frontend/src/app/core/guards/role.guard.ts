import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = Array.isArray(route.data?.['roles']) ? route.data?.['roles'] as string[] : [];

  if (roles.length === 0 || auth.canAccessRole(roles)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
