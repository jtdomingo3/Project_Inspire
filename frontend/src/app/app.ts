import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { InspireApiService } from './core/services/inspire-api.service';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  note: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly api = inject(InspireApiService);

  protected readonly theme = signal<'day' | 'night'>('day');
  protected readonly isAuthenticated = signal(false);
  protected readonly currentRole = signal<'teacher' | 'researcher' | 'admin'>('teacher');
  protected readonly currentUserName = signal('Janice D. Quinones');
  protected readonly currentUserRoleLabel = signal('Teacher');
  protected readonly loginError = signal('');
  protected readonly loginLoading = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly sidebarOpen = signal(true);
  protected loginUsername = 'admin';
  protected loginPassword = 'password123';
  protected readonly mainNavigation: NavigationItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: '📋',
      note: 'Overview and shortcuts'
    },
  ];

  protected readonly lessonNavigation: NavigationItem[] = [
    {
      label: 'New Lesson Plan',
      path: '/lessons',
      icon: '📝',
      note: 'Generate a daily lesson plan'
    },
    {
      label: 'My Lessons',
      path: '/my-lessons',
      icon: '📂',
      note: 'Saved lesson plans'
    },
    {
      label: 'Learner Difficulty Library',
      path: '/learner-difficulty-library',
      icon: '👁',
      note: 'Reference materials'
    },
    {
      label: 'Reflection Logs',
      path: '/reflections',
      icon: '📓',
      note: 'Capture outcomes after teaching'
    },
    {
      label: 'Observations',
      path: '/observations',
      icon: '👀',
      note: 'Track classroom observations'
    }
  ];

  protected readonly adminNavigation: NavigationItem[] = [
    {
      label: 'Admin Analytics',
      path: '/admin',
      icon: '📈',
      note: 'Review lesson and reflection trends',
      adminOnly: true
    },
    {
      label: 'Account Management',
      path: '/account-management',
      icon: '🧑‍💼',
      note: 'Manage user accounts',
      adminOnly: true
    }
  ];

  protected readonly profileNavigation: NavigationItem[] = [
    {
      label: 'My Profile',
      path: '/profile',
      icon: '👤',
      note: 'Your demo profile'
    },
    {
      label: 'Logout',
      path: '/dashboard',
      icon: '🚪',
      note: 'End demo session'
    }
  ];

  protected readonly resourceNavigation: NavigationItem[] = [
    {
      label: 'Resource Library',
      path: '/references',
      icon: '📚',
      note: 'Loaded source documents'
    }
  ];

  protected readonly surveyNavigation: NavigationItem[] = [
    {
      label: 'Pre/Post Survey',
      path: '/surveys',
      icon: '📊',
      note: 'Survey forms and results'
    }
  ];
  protected readonly notifications = [
    'Your lesson plan "Fractions Activity" was saved.',
    'Reminder: Submit reflection log for April 4 lesson.',
    'Pre-intervention survey is now available.'
  ] as const;

  constructor() {
    const savedTheme = window.localStorage.getItem('inspire-theme');
    const savedAuth = window.localStorage.getItem('inspire-demo-auth');

    if (savedTheme === 'dark') {
      this.theme.set('night');
    }

    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth) as { role?: 'teacher' | 'researcher' | 'admin'; name?: string; roleLabel?: string; username?: string };
        if (parsed.role === 'admin') {
          this.setAuthenticatedState('admin', parsed.name || 'Janice D. Quinones', parsed.roleLabel || 'Admin', parsed.username || 'admin');
        } else if (parsed.role === 'researcher') {
          this.setAuthenticatedState('researcher', parsed.name || 'Research Coordinator', parsed.roleLabel || 'Researcher', parsed.username || 'researcher');
        } else if (parsed.role === 'teacher') {
          this.setAuthenticatedState('teacher', parsed.name || 'Janice D. Quinones', parsed.roleLabel || 'Teacher', parsed.username || 'teacher');
        }
      } catch {
        window.localStorage.removeItem('inspire-demo-auth');
      }
    }

    effect(() => {
      const theme = this.theme();
      this.document.body.setAttribute('data-theme', theme === 'night' ? 'dark' : 'light');
      window.localStorage.setItem('inspire-theme', theme);
    });
  }

  protected toggleTheme(): void {
    this.theme.update((current) => current === 'day' ? 'night' : 'day');
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((current) => !current);
  }

  protected toggleNotifications(): void {
    this.notificationsOpen.update((current) => !current);
  }

  protected login(): void {
    const username = this.loginUsername.trim().toLowerCase();
    const password = this.loginPassword.trim();

    if (!username || !password) {
      this.loginError.set('Enter username and password.');
      return;
    }

    this.loginLoading.set(true);
    this.api.login(username, password).subscribe({
      next: (response) => {
        this.loginLoading.set(false);
        if (!response.success || !response.user) {
          this.loginError.set(response.error || 'Login failed.');
          return;
        }

        const role = response.user.role === 'admin' || response.user.role === 'researcher' ? response.user.role : 'teacher';
        this.setAuthenticatedState(role, response.user.display_name, this.api.roleLabel(role), response.user.username);
        this.notificationsOpen.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.loginLoading.set(false);
        this.loginError.set(this.api.describeError(error));
      }
    });
  }

  protected logout(): void {
    this.isAuthenticated.set(false);
    this.currentRole.set('teacher');
    this.currentUserName.set('Janice D. Quinones');
    this.currentUserRoleLabel.set('Teacher');
    this.loginUsername = 'admin';
    this.loginPassword = 'password123';
    this.loginError.set('');
    this.notificationsOpen.set(false);
    window.localStorage.removeItem('inspire-demo-auth');
    this.router.navigateByUrl('/dashboard');
  }

  protected handleNavigationClick(event: MouseEvent, item: NavigationItem): void {
    if (item.adminOnly && !this.canAccessAdmin()) {
      event.preventDefault();
      return;
    }

    this.sidebarOpen.set(false);
  }

  protected canAccessAdmin(): boolean {
    return this.api.canAccessAdmin(this.currentRole());
  }

  protected canManageAccounts(): boolean {
    return this.api.canManageAccounts(this.currentRole());
  }

  private setAuthenticatedState(role: 'teacher' | 'researcher' | 'admin', name: string, roleLabel: string, username: string): void {
    this.isAuthenticated.set(true);
    this.currentRole.set(role);
    this.currentUserName.set(name);
    this.currentUserRoleLabel.set(roleLabel);
    this.loginError.set('');
    window.localStorage.setItem('inspire-demo-auth', JSON.stringify({ role, name, roleLabel, username }));
  }
}
