import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { LessonRecord, ReflectionRecord } from '../../core/models/inspire-api.models';

@Component({
  standalone: true,
  selector: 'app-reflections',
  imports: [ReactiveFormsModule],
  templateUrl: './reflections.component.html',
  styleUrl: './reflections.component.scss'
})
export class ReflectionsComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly lessons = signal<LessonRecord[]>([]);
  readonly reflections = signal<ReflectionRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    subject: ['Math', Validators.required],
    grade: ['Grade 8', Validators.required],
    lesson_plan_linked: ['', Validators.required],
    strategies_used: ['Fraction strips, think-alouds, and oral response options.', Validators.required],
    learner_response: ['Learners stayed engaged when visuals were introduced.', Validators.required],
    effectiveness_rating: [4, [Validators.required, Validators.min(1), Validators.max(5)]],
    inspire_confidence_rating: [4, [Validators.required, Validators.min(1), Validators.max(5)]],
    challenges: ['A few learners needed extra time to interpret the fraction cards.', Validators.required],
    next_steps: ['Pre-teach the vocabulary and add a short review warm-up.', Validators.required]
  });

  ngOnInit(): void {
    forkJoin({
      lessons: this.api.getLessons(),
      reflections: this.api.getReflections()
    }).subscribe({
      next: ({ lessons, reflections }) => {
        this.lessons.set(lessons);
        this.reflections.set(reflections);

        if (lessons.length > 0 && !this.form.controls.lesson_plan_linked.value) {
          this.form.controls.lesson_plan_linked.setValue(lessons[0].title);
        }

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
    const payload = this.form.getRawValue();

    this.api.saveReflection(payload).subscribe({
      next: ({ reflection }) => {
        this.reflections.update((current) => [reflection, ...current]);
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }
}