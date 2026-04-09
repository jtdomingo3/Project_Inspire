import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { LessonRecord } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-lesson-workbench',
  imports: [ReactiveFormsModule],
  templateUrl: './lesson-workbench.component.html',
  styleUrl: './lesson-workbench.component.scss'
})
export class LessonWorkbenchComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly models = signal<string[]>([]);
  readonly references = signal<string[]>([]);
  readonly savedLessons = signal<LessonRecord[]>([]);
  readonly selectedReferences = signal<string[]>([]);
  readonly generatedOutput = signal<string>('');
  readonly loading = signal(true);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    subject: ['', Validators.required],
    grade: ['', Validators.required],
    quarter: ['', Validators.required],
    title: ['', Validators.required],
    objectives: ['', Validators.required],
    difficulty: ['', Validators.required],
    indicators: ['', Validators.required],
    supportTypes: ['', Validators.required],
    customSupport: [''],
    deliveryMode: ['', Validators.required],
    model: ['', Validators.required]
  });

  readonly supportChecklist = [
    'Visual aids',
    'Guided practice',
    'Peer support',
    'Chunked directions',
    'Oral response option'
  ] as const;

  ngOnInit(): void {
    forkJoin({
      models: this.api.getModels(),
      references: this.api.getReferences(),
      lessons: this.api.getLessons()
    }).subscribe({
      next: ({ models, references, lessons }) => {
        this.models.set(models);
        this.references.set(references);
        this.savedLessons.set(lessons);
        if (models.length > 0) {
          this.form.controls.model.setValue(models[0]);
        }
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  toggleReference(reference: string, checked: boolean): void {
    this.selectedReferences.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(reference);
      } else {
        next.delete(reference);
      }
      return Array.from(next);
    });
  }

  generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.generating.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const { model, ...lessonData } = raw;

    this.api.generateLessonPlan({
      model,
      lesson_data: lessonData,
      references: this.selectedReferences()
    }).subscribe({
      next: (response) => {
        if (!response.success) {
          this.error.set(response.error ?? 'The backend returned an unsuccessful response.');
          this.generatedOutput.set('');
        } else {
          this.generatedOutput.set(this.api.formatOutput(response.output));
          if (response.lesson) {
            this.savedLessons.update((current) => {
              const next = current.filter((lesson) => lesson.id !== response.lesson?.id);
              return [response.lesson as LessonRecord, ...next];
            });
          } else {
            this.reloadLessons();
          }
        }
        this.generating.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.generatedOutput.set('');
        this.generating.set(false);
      }
    });
  }

  loadLesson(lesson: LessonRecord): void {
    this.form.patchValue({
      subject: lesson.subject,
      grade: lesson.grade,
      quarter: lesson.quarter,
      title: lesson.title,
      objectives: lesson.objectives,
      difficulty: lesson.difficulty,
      indicators: lesson.indicators,
      supportTypes: lesson.support_types,
      customSupport: lesson.custom_support,
      deliveryMode: lesson.delivery_mode,
      model: lesson.ai_model_used || this.form.controls.model.value
    });
    this.selectedReferences.set(lesson.reference_docs_used ?? []);
    this.generatedOutput.set(lesson.generated_output ?? '');
  }

  private reloadLessons(): void {
    this.api.getLessons().subscribe({
      next: (lessons) => this.savedLessons.set(lessons),
      error: (error) => this.error.set(this.api.describeError(error))
    });
  }
}