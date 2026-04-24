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
    affiliated_school: '',

    role: 'teacher',
    password: '',
    active: true,
    designation: '',
    employee_id: '',
    supervisor: '',
    principal: '',
    subject_area: '',
    grade_level_handled: '',
    years_experience: 0,
    special_education_training: false,
    research_consent: false
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
      password: '',
      active: account.active,
      designation: account.designation || '',
      employee_id: account.employee_id || '',
      supervisor: account.supervisor || '',
      principal: account.principal || '',
      subject_area: account.subject_area || '',
      grade_level_handled: account.grade_level_handled || '',
      years_experience: account.years_experience || 0,
      special_education_training: !!account.special_education_training,
      research_consent: !!account.research_consent
    };
  }

  resetForm(): void {
    this.form = {
      id: 0,
      username: '',
      display_name: '',
      affiliated_school: 'San Felipe National High School · Basud, Camarines Norte',
      role: 'teacher',
      password: '',
      active: true,
      designation: '',
      employee_id: '',
      supervisor: '',
      principal: '',
      subject_area: '',
      grade_level_handled: '',
      years_experience: 0,
      special_education_training: false,
      research_consent: false
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
    const payload: Partial<UserAccount> & { username: string; role: string; display_name: string; password?: string } = {
      id: this.form.id || undefined,
      username,
      display_name: displayName,
      affiliated_school: this.form.affiliated_school.trim(),
      role: this.form.role,
      active: this.form.active,
      designation: this.form.designation.trim(),
      employee_id: this.form.employee_id.trim(),
      supervisor: this.form.supervisor.trim(),
      principal: this.form.principal.trim(),
      subject_area: this.form.subject_area.trim(),
      grade_level_handled: this.form.grade_level_handled.trim(),
      years_experience: this.form.years_experience,
      special_education_training: this.form.special_education_training,
      research_consent: this.form.research_consent
    };

    if (this.form.password) {
      payload.password = this.form.password;
    }

    this.api.saveAccount(payload).subscribe({
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
    if (!confirm(`Are you sure you want to delete account for ${account.display_name}?`)) return;
    this.api.deleteAccount(account.id).subscribe({
      next: () => this.refresh(),
      error: (error) => this.error.set(this.api.describeError(error))
    });
  }
}
