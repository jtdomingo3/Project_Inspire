import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  UpdateUserLlmSettingsPayload,
  UserLlmSettings
} from '../../core/models/inspire-api.models';
import { NotificationService } from '../../core/services/notification.service';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
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

  readonly loading = signal(true);
  readonly isSaving = signal(false);
  readonly llmSettings = signal<UserLlmSettings | null>(null);
  readonly llmProviderOptions = signal(this.fallbackProviderOptions);
  readonly availableModels = signal<string[]>([]);

  llmForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadLlmSettings();

    // Listen to provider changes to update model list
    this.llmForm.get('provider')?.valueChanges.subscribe((provider) => {
      if (provider) {
        this.fetchModelsForProvider(provider);
      }
    });
  }

  private fetchModelsForProvider(provider: string): void {
    this.api.getLlmModels(provider).subscribe({
      next: (models) => {
        this.availableModels.set(models);
      },
      error: (err) => {
        console.error('Failed to fetch models for provider:', provider, err);
        this.availableModels.set([]);
      }
    });
  }

  private initForm() {
    this.llmForm = this.fb.group({
      provider: ['openrouter', [Validators.required]],
      preferred_model: [''],
      openrouter_api_key: [''],
      openai_api_key: [''],
      anthropic_api_key: [''],
      google_api_key: [''],
      xai_api_key: [''],
      custom_model: [''],
      clear_openrouter_api_key: [false],
      clear_openai_api_key: [false],
      clear_anthropic_api_key: [false],
      clear_google_api_key: [false],
      clear_xai_api_key: [false]
    });
  }

  loadLlmSettings(): void {
    this.loading.set(true);
    this.api.getLlmSettings().subscribe({
      next: (settings) => {
        this.loading.set(false);
        this.llmSettings.set(settings);
        this.llmProviderOptions.set(settings.available_providers?.length
          ? settings.available_providers
          : this.fallbackProviderOptions);
        this.availableModels.set(settings.model_options || []);
        this.patchFormFromSettings(settings);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Failed to load LLM settings', this.api.describeError(err));
      }
    });
  }

  saveLlmSettings(): void {
    if (this.llmForm.invalid) {
      return;
    }

    const raw = this.llmForm.value;
    const preferredModel = raw.preferred_model === 'custom' 
      ? String(raw.custom_model || '').trim()
      : raw.preferred_model;

    const clearKeys: string[] = [];
    if (raw.clear_openrouter_api_key) clearKeys.push('openrouter_api_key');
    if (raw.clear_openai_api_key) clearKeys.push('openai_api_key');
    if (raw.clear_anthropic_api_key) clearKeys.push('anthropic_api_key');
    if (raw.clear_google_api_key) clearKeys.push('google_api_key');
    if (raw.clear_xai_api_key) clearKeys.push('xai_api_key');

    const payload: UpdateUserLlmSettingsPayload = {
      provider: raw.provider,
      preferred_model: String(preferredModel || '').trim(),
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

    this.isSaving.set(true);
    this.api.updateLlmSettings(payload).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.llmSettings.set(response.settings);
        this.llmProviderOptions.set(response.settings.available_providers?.length
          ? response.settings.available_providers
          : this.fallbackProviderOptions);
        this.availableModels.set(response.settings.model_options || []);
        this.patchFormFromSettings(response.settings);
        this.notify.success('LLM settings updated successfully');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.notify.error('Failed to update LLM settings', this.api.describeError(err));
      }
    });
  }

  private patchFormFromSettings(settings: UserLlmSettings): void {
    const isCustom = settings.preferred_model && !this.availableModels().includes(settings.preferred_model);
    
    this.llmForm.patchValue({
      provider: settings.provider || 'openrouter',
      preferred_model: isCustom ? 'custom' : (settings.preferred_model || ''),
      custom_model: isCustom ? settings.preferred_model : '',
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
  }
}
