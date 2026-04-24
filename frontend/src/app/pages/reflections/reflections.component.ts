import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { LessonRecord, ReflectionRecord } from '../../core/models/inspire-api.models';

@Component({
  standalone: true,
  selector: 'app-reflections',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reflections.component.html',
  styleUrl: './reflections.component.scss'
})
export class ReflectionsComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificationService = inject(NotificationService);

  readonly lessons = signal<LessonRecord[]>([]);
  readonly reflections = signal<ReflectionRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editingReflectionId = signal<number | null>(null);
  readonly viewingReflection = signal<ReflectionRecord | null>(null);
  readonly deletingReflectionId = signal<number | null>(null);

  readonly form = this.fb.group({
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    subject: ['', Validators.required],
    grade: ['', Validators.required],
    lesson_plan_linked: ['', Validators.required],
    strategies_used: ['', Validators.required],
    learner_response: ['', Validators.required],
    worked_well: ['', Validators.required],
    needs_improvement: ['', Validators.required],
    effectiveness_rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    inspire_confidence_rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    challenges: ['', Validators.required],
    next_steps: ['', Validators.required]
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
    const editingId = this.editingReflectionId();
    const request$ = editingId ? this.api.updateReflection(editingId, payload) : this.api.saveReflection(payload);

    request$.subscribe({
      next: ({ reflection }) => {
        if (editingId) {
          this.reflections.update((current) => current.map((item) => item.id === reflection.id ? reflection : item));
          this.notificationService.addNotification(`Reflection for "${reflection.lesson_plan_linked}" was updated.`);
        } else {
          this.reflections.update((current) => [reflection, ...current]);
          this.notificationService.addNotification(`Reflection for "${reflection.lesson_plan_linked}" was captured.`);
        }

        this.saving.set(false);
        this.closeModal(true);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }

  openModal(): void {
    this.editingReflectionId.set(null);
    this.modalOpen.set(true);
    if (this.lessons().length > 0 && !this.form.controls.lesson_plan_linked.value) {
      this.form.controls.lesson_plan_linked.setValue(this.lessons()[0].title);
    }
  }

  openEdit(reflection: ReflectionRecord): void {
    this.editingReflectionId.set(reflection.id);
    this.modalOpen.set(true);
    this.form.reset({
      date: reflection.date,
      subject: reflection.subject,
      grade: reflection.grade,
      lesson_plan_linked: reflection.lesson_plan_linked,
      strategies_used: reflection.strategies_used,
      learner_response: reflection.learner_response,
      worked_well: reflection.worked_well || '',
      needs_improvement: reflection.needs_improvement || '',
      effectiveness_rating: reflection.effectiveness_rating,
      inspire_confidence_rating: reflection.inspire_confidence_rating,
      challenges: reflection.challenges,
      next_steps: reflection.next_steps
    });
  }

  openView(reflection: ReflectionRecord): void {
    this.viewingReflection.set(reflection);
  }

  closeView(): void {
    this.viewingReflection.set(null);
  }

  deleteReflection(reflection: ReflectionRecord): void {
    if (!confirm('Delete this reflection log? This action cannot be undone.')) {
      return;
    }

    this.deletingReflectionId.set(reflection.id);
    this.api.deleteReflection(reflection.id).subscribe({
      next: () => {
        this.reflections.update((current) => current.filter((item) => item.id !== reflection.id));
        if (this.viewingReflection()?.id === reflection.id) {
          this.viewingReflection.set(null);
        }
        this.deletingReflectionId.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.deletingReflectionId.set(null);
      }
    });
  }

  isDeleting(reflectionId: number): boolean {
    return this.deletingReflectionId() === reflectionId;
  }

  closeModal(reset = false): void {
    this.modalOpen.set(false);
    this.editingReflectionId.set(null);

    if (reset) {
      this.form.reset({
        date: new Date().toISOString().slice(0, 10),
        subject: '',
        grade: '',
        lesson_plan_linked: this.lessons()[0]?.title || '',
        strategies_used: '',
        learner_response: '',
        worked_well: '',
        needs_improvement: '',
        effectiveness_rating: 0,
        inspire_confidence_rating: 0,
        challenges: '',
        next_steps: ''
      });
      this.form.markAsPristine();
      this.form.markAsUntouched();
    }
  }

  stars(rating: number): string {
    const safe = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(safe) + '☆'.repeat(5 - safe);
  }
}