import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SetupBootstrapPayload } from './core/models/inspire-api.models';
import { ChatbotWidgetComponent } from './core/components/chatbot-widget/chatbot-widget.component';
import { AuthService } from './core/services/auth.service';
import { InspireApiService } from './core/services/inspire-api.service';
import { NotificationService } from './core/services/notification.service';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  note: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet, ChatbotWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly api = inject(InspireApiService);
  private readonly auth = inject(AuthService);
  protected readonly notificationService = inject(NotificationService);

  protected readonly theme = signal<'day' | 'night'>('day');
  protected readonly isAuthenticated = signal(false);
  protected readonly currentRole = signal<'teacher' | 'researcher' | 'admin'>('teacher');
  protected readonly currentUserName = signal('Janice D. Quinones');
  protected readonly currentUserRoleLabel = signal('Teacher');
  protected readonly loginError = signal('');
  protected readonly loginLoading = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly sidebarOpen = signal(true);
  protected readonly showProviderMessage = signal(false);
  protected loginUsername = '';
  protected loginPassword = '';
  protected readonly mainNavigation: NavigationItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: '📋',
      note: 'Overview and shortcuts'
    },
    {
      label: 'Inspire Assistant',
      path: '/assistant',
      icon: '🤖',
      note: 'Full-page AI assistant panel'
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
  protected readonly notifications = this.notificationService.notifications;

  constructor() {
    const savedTheme = window.localStorage.getItem('inspire-theme');

    if (savedTheme === 'dark') {
      this.theme.set('night');
    }

    this.restoreStoredSession();
    this.loadSetupStatus();

    effect(() => {
      const theme = this.theme();
      this.document.body.setAttribute('data-theme', theme === 'night' ? 'dark' : 'light');
      window.localStorage.setItem('inspire-theme', theme);
    });
  }

  private restoreStoredSession(): void {
    const savedAuth = window.localStorage.getItem('inspire-demo-auth');
    const savedToken = window.localStorage.getItem('inspire-token');

    if (savedAuth && savedToken) {
      try {
        const parsed = JSON.parse(savedAuth) as { role?: 'teacher' | 'researcher' | 'admin'; name?: string; roleLabel?: string; username?: string; school?: string };
        if (parsed.role === 'admin') {
          this.setAuthenticatedState('admin', parsed.name || 'Janice D. Quinones', parsed.roleLabel || 'Admin', parsed.username || 'admin', parsed.school || 'San Felipe National High School · Basud, Camarines Norte', savedToken);
        } else if (parsed.role === 'researcher') {
          this.setAuthenticatedState('researcher', parsed.name || 'Research Coordinator', parsed.roleLabel || 'Researcher', parsed.username || 'researcher', parsed.school || 'San Felipe National High School · Basud, Camarines Norte', savedToken);
        } else if (parsed.role === 'teacher') {
          this.setAuthenticatedState('teacher', parsed.name || 'Janice D. Quinones', parsed.roleLabel || 'Teacher', parsed.username || 'teacher', parsed.school || 'San Felipe National High School · Basud, Camarines Norte', savedToken);
        }
      } catch {
        window.localStorage.removeItem('inspire-demo-auth');
      }
    } else if (savedAuth && !savedToken) {
      window.localStorage.removeItem('inspire-demo-auth');
    }
  }

  private loadSetupStatus(): void {
    this.api.getSetupStatus().subscribe({
      next: () => {
        if (this.auth.isAuthenticated()) {
          this.auth.refreshAuthSession().subscribe({
            next: (refreshed) => {
              if (!refreshed) {
                this.logout();
              }
            },
            error: () => {
              this.logout();
            }
          });
        }
      }
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

  protected clearNotifications(): void {
    this.notificationService.clearNotifications();
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
        this.setAuthenticatedState(
          role,
          response.user.display_name,
          this.api.roleLabel(role),
          response.user.username,
          response.user.affiliated_school || 'San Felipe National High School · Basud, Camarines Norte',
          response.token || ''
        );
        this.notificationsOpen.set(false);
        this.showProviderMessage.set(true);
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.loginLoading.set(false);
        this.loginError.set(this.api.describeError(error));
      }
    });
  }


  protected skipSetup(): void {
    // No-op - setup removed
  }

  protected logout(): void {
    this.isAuthenticated.set(false);
    this.currentRole.set('teacher');
    this.currentUserName.set('Janice D. Quinones');
    this.currentUserRoleLabel.set('Teacher');
    this.loginUsername = '';
    this.loginPassword = '';
    this.loginError.set('');
    this.notificationsOpen.set(false);
    this.auth.clearSession();
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

  private setAuthenticatedState(role: 'teacher' | 'researcher' | 'admin', name: string, roleLabel: string, username: string, school: string, token?: string): void {
    this.isAuthenticated.set(true);
    this.currentRole.set(role);
    this.currentUserName.set(name);
    this.currentUserRoleLabel.set(roleLabel);
    this.loginError.set('');
    window.localStorage.setItem('inspire-demo-auth', JSON.stringify({ role, name, roleLabel, username, school }));
    if (token) {
      window.localStorage.setItem('inspire-token', token);
    }
  }
}
