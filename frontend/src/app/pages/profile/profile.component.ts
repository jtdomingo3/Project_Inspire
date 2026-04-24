import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InspireApiService } from '../../core/services/inspire-api.service';
import { UserAccount } from '../../core/models/inspire-api.models';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);

  readonly user = signal<UserAccount | null>(null);
  readonly isEditing = signal(false);
  readonly isChangingPassword = signal(false);
  readonly isSaving = signal(false);

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  ngOnInit() {
    this.initForms();
    this.loadProfile();
  }

  private initForms() {
    this.profileForm = this.fb.group({
      display_name: ['', [Validators.required]],
      affiliated_school: [''],
      designation: [''],
      employee_id: [''],
      subject_area: [''],
      grade_level_handled: [''],
      years_experience: [0, [Validators.min(0)]],
      special_education_training: [false],
      research_consent: [false],
      supervisor: [''],
      principal: ['']
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('new_password')?.value === g.get('confirm_password')?.value
      ? null : { mismatch: true };
  }

  loadProfile() {
    this.api.getProfile().subscribe({
      next: (user) => {
        this.user.set(user);
        this.profileForm.patchValue(user);
      },
      error: (err) => this.notify.error('Failed to load profile', this.api.describeError(err))
    });
  }

  toggleEdit() {
    if (this.isEditing()) {
      this.profileForm.patchValue(this.user()!);
    }
    this.isEditing.set(!this.isEditing());
  }

  saveProfile() {
    if (this.profileForm.invalid) return;

    this.isSaving.set(true);
    this.api.updateProfile(this.profileForm.value).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.isEditing.set(false);
        this.isSaving.set(false);
        this.notify.success('Profile updated successfully');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.notify.error('Update failed', this.api.describeError(err));
      }
    });
  }

  toggleChangePassword() {
    this.isChangingPassword.set(!this.isChangingPassword());
    if (!this.isChangingPassword()) {
      this.passwordForm.reset();
    }
  }

  changePassword() {
    if (this.passwordForm.invalid) return;

    const { current_password, new_password } = this.passwordForm.value;
    this.isSaving.set(true);
    this.api.changePassword(current_password, new_password).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isChangingPassword.set(false);
        this.passwordForm.reset();
        this.notify.success('Password changed successfully');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.notify.error('Failed to change password', this.api.describeError(err));
      }
    });
  }
}
