import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { ObservationRecord } from '../../core/models/inspire-api.models';

@Component({
  standalone: true,
  selector: 'app-observations',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './observations.component.html',
  styleUrl: './observations.component.scss'
})
export class ObservationsComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly observations = signal<ObservationRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'list' | 'new'>('list');

  readonly phases = ['Pre-Intervention', 'During Intervention', 'Post-Intervention'] as const;
  readonly focuses = ['Accommodation Use', 'Modification Use', 'Differentiation', 'Learner Participation', 'Strategy Application'] as const;

  readonly form = this.fb.group({
    observation_date: ['', Validators.required],
    teacher_observed: ['', Validators.required],
    subject: ['', Validators.required],
    focus: ['', Validators.required],
    phase: ['', Validators.required],
    rating: ['', [Validators.required, Validators.pattern(/^[1-5]$/)]],
    notes: ['', Validators.required]
  });

  ngOnInit(): void {
    this.api.getObservations().subscribe({
      next: (observations) => {
        this.observations.set(observations);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();
    this.api.saveObservation({
      ...raw,
      rating: Number(raw.rating)
    }).subscribe({
      next: ({ observation }) => {
        this.observations.update((current) => [observation, ...current]);
        this.saving.set(false);
        this.activeTab.set('list');
        this.resetForm();
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }

  setTab(tab: 'list' | 'new'): void {
    this.activeTab.set(tab);
  }

  private resetForm(): void {
    this.form.reset({
      observation_date: '',
      teacher_observed: '',
      subject: '',
      focus: '',
      phase: '',
      rating: '',
      notes: ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}