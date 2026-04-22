import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { InspireApiService } from './inspire-api.service';

type StoredAuth = {
  role?: 'teacher' | 'researcher' | 'admin' | string;
  name?: string;
  roleLabel?: string;
  username?: string;
  school?: string;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly api = inject(InspireApiService);

  getToken(): string {
    return window.localStorage.getItem('inspire-token') || '';
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getRole(): string {
    const raw = window.localStorage.getItem('inspire-demo-auth');
    if (!raw) {
      return 'teacher';
    }

    try {
      const parsed = JSON.parse(raw) as StoredAuth;
      return parsed.role || 'teacher';
    } catch {
      return 'teacher';
    }
  }

  canAccessRole(requiredRoles: string[]): boolean {
    return requiredRoles.includes(this.getRole());
  }

  refreshAuthSession(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      return new Observable((subscriber) => {
        subscriber.next(false);
        subscriber.complete();
      });
    }

    return this.api.refreshToken().pipe(
      tap((response) => {
        if (response.token) {
          window.localStorage.setItem('inspire-token', response.token);
        }
        if (response.user) {
          const role = response.user.role === 'admin' || response.user.role === 'researcher' ? response.user.role : 'teacher';
          const roleLabel = this.api.roleLabel(role);
          window.localStorage.setItem('inspire-demo-auth', JSON.stringify({
            role,
            name: response.user.display_name,
            roleLabel,
            username: response.user.username,
            school: response.user.affiliated_school || 'San Felipe National High School · Basud, Camarines Norte'
          }));
        }
      }),
      map((response) => Boolean(response.success && response.token))
    );
  }

  clearSession(): void {
    window.localStorage.removeItem('inspire-token');
    window.localStorage.removeItem('inspire-demo-auth');
  }
}
