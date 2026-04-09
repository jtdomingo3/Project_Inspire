import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LessonRecord } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-my-lessons',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './my-lessons.component.html',
  styleUrl: './my-lessons.component.scss'
})
export class MyLessonsComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lessons = signal<LessonRecord[]>([]);
  readonly modalMode = signal<'view' | 'edit' | null>(null);
  readonly selectedLesson = signal<LessonRecord | null>(null);
  readonly saving = signal(false);
  readonly deletingLessonId = signal<number | null>(null);

  readonly form = this.fb.group({
    title: ['', Validators.required],
    subject: ['', Validators.required],
    grade: ['', Validators.required],
    difficulty: ['', Validators.required],
    objectives: ['', Validators.required],
    status: ['', Validators.required]
  });

  ngOnInit(): void {
    this.api.getLessons().subscribe({
      next: (lessons) => {
        this.lessons.set(lessons);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  openView(lesson: LessonRecord): void {
    this.selectedLesson.set(lesson);
    this.modalMode.set('view');
  }

  openEdit(lesson: LessonRecord): void {
    this.selectedLesson.set(lesson);
    this.modalMode.set('edit');
    this.form.reset({
      title: lesson.title || '',
      subject: lesson.subject || '',
      grade: lesson.grade || '',
      difficulty: lesson.difficulty || '',
      objectives: lesson.objectives || '',
      status: lesson.status || 'draft'
    });
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedLesson.set(null);
  }

  saveEdit(): void {
    const lesson = this.selectedLesson();
    if (!lesson || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const values = this.form.getRawValue();
    this.api.updateLesson(lesson.id, {
      ...lesson,
      ...values
    }).subscribe({
      next: ({ lesson: updated }) => {
        this.lessons.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.saving.set(false);
        this.closeModal();
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }

  deleteLesson(lesson: LessonRecord): void {
    if (!confirm('Delete this lesson? This action cannot be undone.')) {
      return;
    }

    this.deletingLessonId.set(lesson.id);
    this.api.deleteLesson(lesson.id).subscribe({
      next: () => {
        this.lessons.update((items) => items.filter((item) => item.id !== lesson.id));
        this.deletingLessonId.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.deletingLessonId.set(null);
      }
    });
  }

  isDeleting(lessonId: number): boolean {
    return this.deletingLessonId() === lessonId;
  }
}
