import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LessonRecord } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-my-lessons',
  imports: [CommonModule, RouterLink],
  templateUrl: './my-lessons.component.html',
  styleUrl: './my-lessons.component.scss'
})
export class MyLessonsComponent implements OnInit {
  private readonly api = inject(InspireApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lessons = signal<LessonRecord[]>([]);

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
}
