import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-setup',
  imports: [FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
  private readonly api = inject(InspireApiService);
  private readonly router = inject(Router);

  protected username = '';
  protected displayName = '';
  protected affiliatedSchool = '';
  protected password = '';
  protected confirmPassword = '';

  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly success = signal(false);

  protected submit(): void {
    const username = this.username.trim().toLowerCase();
    const password = this.password.trim();
    const confirmPassword = this.confirmPassword.trim();

    if (!username || !password) {
      this.error.set('Username and password are required.');
      return;
    }

    if (password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api.runSetup({
      username,
      password,
      display_name: this.displayName.trim() || username,
      affiliated_school: this.affiliatedSchool.trim(),
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.success.set(true);
          setTimeout(() => this.router.navigateByUrl('/dashboard'), 2000);
        } else {
          this.error.set(response.error || 'Setup failed. Please try again.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        const body = err?.error;
        this.error.set(
          (body && typeof body === 'object' && body.error) ? String(body.error) : 'Setup failed. Please try again.'
        );
      },
    });
  }
}
