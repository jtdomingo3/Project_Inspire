import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly _notifications = signal<string[]>([
    'Your lesson plan "Fractions Activity" was saved.',
    'Reminder: Submit reflection log for April 4 lesson.',
    'Pre-intervention survey is now available.'
  ]);

  readonly notifications = this._notifications.asReadonly();

  addNotification(message: string): void {
    this._notifications.update(current => [message, ...current]);
  }

  success(message: string): void {
    this.addNotification(`✅ ${message}`);
  }

  error(title: string, message?: string): void {
    this.addNotification(`❌ ${title}${message ? ': ' + message : ''}`);
  }

  info(message: string): void {
    this.addNotification(`ℹ️ ${message}`);
  }

  clearNotifications(): void {
    this._notifications.set([]);
  }
}
