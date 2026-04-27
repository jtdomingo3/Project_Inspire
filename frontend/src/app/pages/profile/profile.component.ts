import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InspireApiService } from '../../core/services/inspire-api.service';
import {
  UpdateUserLlmSettingsPayload,
  UserAccount,
  UserLlmSettings
} from '../../core/models/inspire-api.models';
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
  private readonly fallbackProviderOptions = [
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Claude' },
    { id: 'google', label: 'Gemini' },
    { id: 'xai', label: 'Grok' }
  ];

  readonly user = signal<UserAccount | null>(null);
  readonly llmSettings = signal<UserLlmSettings | null>(null);
  readonly llmProviderOptions = signal(this.fallbackProviderOptions);
  readonly isEditing = signal(false);
  readonly isChangingPassword = signal(false);
  readonly isSaving = signal(false);
  readonly isSavingLlm = signal(false);

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  llmForm!: FormGroup;

  ngOnInit() {
    this.initForms();
    this.loadProfile();
    this.loadLlmSettings();
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

    this.llmForm = this.fb.group({
      provider: ['openrouter', [Validators.required]],
      preferred_model: [''],
      openrouter_api_key: [''],
      openai_api_key: [''],
      anthropic_api_key: [''],
      google_api_key: [''],
      xai_api_key: [''],
      clear_openrouter_api_key: [false],
      clear_openai_api_key: [false],
      clear_anthropic_api_key: [false],
      clear_google_api_key: [false],
      clear_xai_api_key: [false]
    });
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

  loadLlmSettings() {
    this.api.getLlmSettings().subscribe({
      next: (settings) => {
        this.llmSettings.set(settings);
        this.llmProviderOptions.set(settings.available_providers?.length
          ? settings.available_providers
          : this.fallbackProviderOptions);
        this.llmForm.patchValue({
          provider: settings.provider || 'openrouter',
          preferred_model: settings.preferred_model || '',
          openrouter_api_key: '',
          openai_api_key: '',
          anthropic_api_key: '',
          google_api_key: '',
          xai_api_key: '',
          clear_openrouter_api_key: false,
          clear_openai_api_key: false,
          clear_anthropic_api_key: false,
          clear_google_api_key: false,
          clear_xai_api_key: false
        });
      },
      error: (err) => this.notify.error('Failed to load LLM settings', this.api.describeError(err))
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

  saveLlmSettings() {
    if (this.llmForm.invalid) {
      return;
    }

    const raw = this.llmForm.value;
    const clearKeys: string[] = [];
    if (raw.clear_openrouter_api_key) clearKeys.push('openrouter_api_key');
    if (raw.clear_openai_api_key) clearKeys.push('openai_api_key');
    if (raw.clear_anthropic_api_key) clearKeys.push('anthropic_api_key');
    if (raw.clear_google_api_key) clearKeys.push('google_api_key');
    if (raw.clear_xai_api_key) clearKeys.push('xai_api_key');

    const payload: UpdateUserLlmSettingsPayload = {
      provider: raw.provider,
      preferred_model: String(raw.preferred_model || '').trim(),
      clear_keys: clearKeys
    };

    const maybeAddApiKey = (
      field: 'openrouter_api_key' | 'openai_api_key' | 'anthropic_api_key' | 'google_api_key' | 'xai_api_key',
      value: unknown
    ) => {
      const normalized = String(value || '').trim();
      if (normalized) {
        payload[field] = normalized;
      }
    };

    maybeAddApiKey('openrouter_api_key', raw.openrouter_api_key);
    maybeAddApiKey('openai_api_key', raw.openai_api_key);
    maybeAddApiKey('anthropic_api_key', raw.anthropic_api_key);
    maybeAddApiKey('google_api_key', raw.google_api_key);
    maybeAddApiKey('xai_api_key', raw.xai_api_key);

    this.isSavingLlm.set(true);
    this.api.updateLlmSettings(payload).subscribe({
      next: (response) => {
        this.isSavingLlm.set(false);
        this.llmSettings.set(response.settings);
        this.llmProviderOptions.set(response.settings.available_providers?.length
          ? response.settings.available_providers
          : this.fallbackProviderOptions);
        this.llmForm.patchValue({
          provider: response.settings.provider || 'openrouter',
          preferred_model: response.settings.preferred_model || '',
          openrouter_api_key: '',
          openai_api_key: '',
          anthropic_api_key: '',
          google_api_key: '',
          xai_api_key: '',
          clear_openrouter_api_key: false,
          clear_openai_api_key: false,
          clear_anthropic_api_key: false,
          clear_google_api_key: false,
          clear_xai_api_key: false
        });
        this.notify.success('LLM settings updated successfully');
      },
      error: (err) => {
        this.isSavingLlm.set(false);
        this.notify.error('Failed to update LLM settings', this.api.describeError(err));
      }
    });
  }
}
