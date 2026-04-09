import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UserAccount } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-account-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent implements OnInit {
  private readonly api = inject(InspireApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly accounts = signal<UserAccount[]>([]);

  form = {
    id: 0,
    username: '',
    display_name: '',
    affiliated_school: 'San Felipe National High School · Basud, Camarines Norte',
    role: 'teacher',
    password: 'password123',
    active: true
  };

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.listAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  edit(account: UserAccount): void {
    this.form = {
      id: account.id,
      username: account.username,
      display_name: account.display_name,
      affiliated_school: account.affiliated_school || 'San Felipe National High School · Basud, Camarines Norte',
      role: account.role,
      password: 'password123',
      active: account.active
    };
  }

  resetForm(): void {
    this.form = {
      id: 0,
      username: '',
      display_name: '',
      affiliated_school: 'San Felipe National High School · Basud, Camarines Norte',
      role: 'teacher',
      password: 'password123',
      active: true
    };
  }

  save(): void {
    const username = this.form.username.trim().toLowerCase();
    const displayName = this.form.display_name.trim();

    if (!username || !displayName) {
      this.error.set('Username and display name are required.');
      return;
    }

    this.saving.set(true);
    this.api.saveAccount({
      id: this.form.id || undefined,
      username,
      display_name: displayName,
      affiliated_school: this.form.affiliated_school.trim(),
      role: this.form.role,
      password: this.form.password,
      active: this.form.active
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.error.set(null);
        this.resetForm();
        this.refresh();
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(this.api.describeError(error));
      }
    });
  }

  remove(account: UserAccount): void {
    this.api.deleteAccount(account.id).subscribe({
      next: () => this.refresh(),
      error: (error) => this.error.set(this.api.describeError(error))
    });
  }
}
