import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { ObservationRecord } from '../../core/models/inspire-api.models';

@Component({
  standalone: true,
  selector: 'app-observations',
  imports: [ReactiveFormsModule],
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

  readonly form = this.fb.group({
    observation_date: [new Date().toISOString().slice(0, 10), Validators.required],
    teacher_observed: ['Janice D. Quiñones', Validators.required],
    subject: ['Math 8', Validators.required],
    focus: ['Differentiation', Validators.required],
    phase: ['During Intervention', Validators.required],
    rating: [4, [Validators.required, Validators.min(1), Validators.max(5)]],
    notes: ['The lesson used visuals and partner support effectively.', Validators.required]
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

    this.api.saveObservation(this.form.getRawValue()).subscribe({
      next: ({ observation }) => {
        this.observations.update((current) => [observation, ...current]);
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }
}