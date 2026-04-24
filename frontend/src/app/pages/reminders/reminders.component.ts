import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InspireApiService } from '../../core/services/inspire-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReminderRecord } from '../../core/models/inspire-api.models';

@Component({
  standalone: true,
  selector: 'app-reminders',
  imports: [CommonModule, FormsModule],
  templateUrl: './reminders.component.html',
  styleUrl: './reminders.component.scss'
})
export class RemindersComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly notificationService = inject(NotificationService);

  readonly reminders = signal<ReminderRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  newReminderContent = '';
  newReminderDueDate = '';

  ngOnInit(): void {
    this.loadReminders();
  }

  loadReminders(): void {
    this.loading.set(true);
    this.api.getReminders().subscribe({
      next: (reminders) => {
        this.reminders.set(reminders);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.api.describeError(err));
        this.loading.set(false);
      }
    });
  }

  addReminder(): void {
    if (!this.newReminderContent.trim()) return;

    this.api.saveReminder({
      content: this.newReminderContent.trim(),
      due_date: this.newReminderDueDate
    }).subscribe({
      next: (res) => {
        this.reminders.update(current => [res.reminder, ...current]);
        this.newReminderContent = '';
        this.newReminderDueDate = '';
        this.notificationService.addNotification(`Reminder added: "${res.reminder.content}"`);
      },
      error: (err) => {
        this.error.set(this.api.describeError(err));
      }
    });
  }

  toggleReminder(reminder: ReminderRecord): void {
    const newStatus = !reminder.is_completed;
    this.api.updateReminder(reminder.id, { is_completed: newStatus }).subscribe({
      next: (res) => {
        this.reminders.update(current => 
          current.map(r => r.id === reminder.id ? res.reminder : r)
        );
      }
    });
  }

  deleteReminder(id: number): void {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    this.api.deleteReminder(id).subscribe({
      next: () => {
        this.reminders.update(current => current.filter(r => r.id !== id));
      }
    });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
}
