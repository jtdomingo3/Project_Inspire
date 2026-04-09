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
  readonly editingObservationId = signal<number | null>(null);
  readonly viewingObservation = signal<ObservationRecord | null>(null);
  readonly deletingObservationId = signal<number | null>(null);

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
    const payload = {
      ...raw,
      rating: Number(raw.rating)
    };

    const editingId = this.editingObservationId();
    const request$ = editingId ? this.api.updateObservation(editingId, payload) : this.api.saveObservation(payload);

    request$.subscribe({
      next: ({ observation }) => {
        if (editingId) {
          this.observations.update((current) => current.map((item) => item.id === observation.id ? observation : item));
        } else {
          this.observations.update((current) => [observation, ...current]);
        }
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
    if (tab === 'new' && this.activeTab() !== 'new') {
      this.editingObservationId.set(null);
      this.resetForm();
    }
    this.activeTab.set(tab);
  }

  openView(observation: ObservationRecord): void {
    this.viewingObservation.set(observation);
  }

  clearView(): void {
    this.viewingObservation.set(null);
  }

  openEdit(observation: ObservationRecord): void {
    this.editingObservationId.set(observation.id);
    this.activeTab.set('new');
    this.form.reset({
      observation_date: observation.observation_date,
      teacher_observed: observation.teacher_observed,
      subject: observation.subject,
      focus: observation.focus,
      phase: observation.phase,
      rating: String(observation.rating),
      notes: observation.notes
    });
  }

  deleteObservation(observation: ObservationRecord): void {
    if (!confirm('Delete this observation? This action cannot be undone.')) {
      return;
    }

    this.deletingObservationId.set(observation.id);
    this.api.deleteObservation(observation.id).subscribe({
      next: () => {
        this.observations.update((current) => current.filter((item) => item.id !== observation.id));
        if (this.viewingObservation()?.id === observation.id) {
          this.viewingObservation.set(null);
        }
        this.deletingObservationId.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.deletingObservationId.set(null);
      }
    });
  }

  isDeleting(observationId: number): boolean {
    return this.deletingObservationId() === observationId;
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
    this.editingObservationId.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}