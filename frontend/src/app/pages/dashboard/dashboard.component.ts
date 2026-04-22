import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminStats, LessonRecord } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly router = inject(Router);

  readonly lessons = signal<LessonRecord[]>([]);
  readonly stats = signal<AdminStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  readonly quickActions: Array<{ label: string; route: string; primary?: boolean }> = [
    { label: '➕ Create New Lesson Plan', route: '/lessons', primary: true },
    { label: '📓 Write Reflection', route: '/reflections' },
    { label: '📚 Browse Resources', route: '/references' }
  ];

  readonly reminders = [
    'Post-intervention survey due: Sept 1, 2026',
    'Submit reflection log for last week'
  ] as const;

  ngOnInit(): void {
    this.loading.set(true);
    this.warning.set(null);
    forkJoin({
      lessons: this.api.getLessons().pipe(catchError((error) => of({ __error: this.api.describeError(error), data: [] as LessonRecord[] }))),
      stats: this.api.getAdminStats().pipe(catchError((error) => of({ __error: this.api.describeError(error), data: null as AdminStats | null })))
    }).subscribe({
      next: ({ lessons, stats }) => {
        const lessonData = Array.isArray(lessons) ? lessons : lessons.data;
        const statsData = stats && 'top_difficulties' in stats ? stats as AdminStats : (stats as { data: AdminStats | null }).data;

        this.lessons.set(lessonData);
        this.stats.set(statsData ?? this.createFallbackStats());

        const errors: string[] = [];
        if (!Array.isArray(lessons) && lessons.__error) {
          errors.push(`Lessons failed: ${lessons.__error}`);
        }
        if (stats && !('top_difficulties' in stats) && stats.__error) {
          errors.push(`Dashboard stats failed: ${stats.__error}`);
        }

        this.warning.set(errors.length ? errors.join(' ') : null);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  lessonStatusBadge(status: string | undefined): string {
    return status === 'final' ? 'badge badge-status-final' : 'badge badge-status-draft';
  }

  learnerProfileCount(): number {
    const stats = this.stats();
    return stats?.observations_submitted ?? 0;
  }

  strategiesGeneratedCount(): number {
    const stats = this.stats();
    return stats ? stats.top_supports.reduce((total, item) => total + item.value, 0) + stats.lessons_created : 0;
  }

  openLesson(lessonId: number): void {
    this.router.navigate(['/my-lessons'], { queryParams: { view: lessonId } });
  }

  private createFallbackStats(): AdminStats {
    return {
      user_id: 0,
      username: '',
      display_name: '',
      lessons_created: this.lessons().length,
      reflections_submitted: 0,
      observations_submitted: 0,
      survey_completion: '0 Pre · 0 Post',
      average_effectiveness_rating: 0,
      top_difficulties: [],
      top_supports: [],
      daily_survey_scores: [],
      recent_lessons: [],
      recent_reflections: [],
      recent_observations: [],
      recent_surveys: []
    };
  }
}
