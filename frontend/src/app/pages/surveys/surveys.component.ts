import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { SurveyQuestionsResponse, SurveyRecord } from '../../core/models/inspire-api.models';

type SurveyType = 'pre' | 'post';

@Component({
  standalone: true,
  selector: 'app-surveys',
  imports: [CommonModule],
  templateUrl: './surveys.component.html',
  styleUrl: './surveys.component.scss'
})
export class SurveysComponent implements OnInit {
  private readonly api = inject(InspireApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<SurveyType>('pre');
  readonly questions = signal<SurveyQuestionsResponse>({ pre: [], post: [] });
  readonly surveys = signal<SurveyRecord[]>([]);
  readonly preResponses = signal<Record<string, number>>({});
  readonly postResponses = signal<Record<string, number>>({});

  readonly currentQuestions = computed(() => this.questions()[this.activeTab()] ?? []);
  readonly currentResponses = computed(() => this.activeTab() === 'pre' ? this.preResponses() : this.postResponses());

  ngOnInit(): void {
    this.api.getSurveyQuestions().subscribe({
      next: (questions) => {
        this.questions.set(questions);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
      }
    });

    this.api.getSurveys().subscribe({
      next: (surveys) => {
        this.surveys.set(surveys);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  setTab(tab: SurveyType): void {
    this.activeTab.set(tab);
  }

  setResponse(questionIndex: number, value: number): void {
    const key = `q${questionIndex + 1}`;
    if (this.activeTab() === 'pre') {
      this.preResponses.update((responses) => ({ ...responses, [key]: value }));
    } else {
      this.postResponses.update((responses) => ({ ...responses, [key]: value }));
    }
  }

  isSelected(questionIndex: number, rating: number): boolean {
    const key = `q${questionIndex + 1}`;
    return this.currentResponses()[key] === rating;
  }

  submit(): void {
    this.saving.set(true);
    const payload = {
      survey_type: this.activeTab(),
      question_responses: this.currentResponses(),
      completed_at: new Date().toISOString()
    };

    this.api.saveSurvey(payload).subscribe({
      next: ({ survey }) => {
        this.surveys.update((current) => [survey, ...current]);
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }
}