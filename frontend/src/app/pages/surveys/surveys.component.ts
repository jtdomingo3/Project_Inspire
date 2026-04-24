import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { InspireApiService } from '../../core/services/inspire-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { SurveyQuestionsResponse, SurveyRecord } from '../../core/models/inspire-api.models';

type SurveyType = 'pre' | 'post';

interface SurveySection {
  title: string;
  questions: string[];
  startIndex: number;
}

@Component({
  standalone: true,
  selector: 'app-surveys',
  imports: [CommonModule],
  templateUrl: './surveys.component.html',
  styleUrl: './surveys.component.scss'
})
export class SurveysComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly notificationService = inject(NotificationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<SurveyType>('pre');
  readonly questions = signal<SurveyQuestionsResponse>({ pre: [], post: [] });
  readonly surveys = signal<SurveyRecord[]>([]);
  readonly viewingSurveyId = signal<number | null>(null);
  readonly deletingSurveyId = signal<number | null>(null);
  readonly preResponses = signal<Record<string, number>>({});
  readonly postResponses = signal<Record<string, number>>({});

  readonly currentQuestions = computed(() => this.questions()[this.activeTab()] ?? []);
  readonly currentResponses = computed(() => this.activeTab() === 'pre' ? this.preResponses() : this.postResponses());
  readonly surveySections = computed<SurveySection[]>(() => {
    const questions = this.currentQuestions();
    if (questions.length <= 10) {
      return [{ title: 'Section A — Survey Statements', questions, startIndex: 0 }];
    }

    return [
      {
        title: 'Section A — Challenges in Inclusive Education',
        questions: questions.slice(0, 10),
        startIndex: 0
      },
      {
        title: 'Section B — Competence in Inclusive Teaching',
        questions: questions.slice(10),
        startIndex: 10
      }
    ];
  });

  readonly canSubmit = computed(() => {
    const expected = this.currentQuestions().length;
    const answered = Object.keys(this.currentResponses()).length;
    return expected > 0 && answered === expected;
  });
  readonly answeredCurrentCount = computed(() => Object.keys(this.currentResponses()).length);
  readonly completionPercent = computed(() => {
    const total = this.currentQuestions().length;
    if (!total) {
      return 0;
    }

    return Math.round((this.answeredCurrentCount() / total) * 100);
  });

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
    if (!this.canSubmit()) {
      this.error.set('Please answer all survey items before submitting.');
      return;
    }

    this.saving.set(true);
    const payload = {
      survey_type: this.activeTab(),
      question_responses: this.currentResponses(),
      completed_at: new Date().toISOString()
    };

    this.api.saveSurvey(payload).subscribe({
      next: ({ survey }) => {
        this.surveys.update((current) => [survey, ...current]);
        this.notificationService.addNotification(`${survey.survey_type.toUpperCase()} Survey was submitted.`);
        if (this.activeTab() === 'pre') {
          this.preResponses.set({});
        } else {
          this.postResponses.set({});
        }
        this.error.set(null);
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }

  answeredCount(survey: SurveyRecord): number {
    return Object.values(survey.question_responses || {}).filter((value) => Number(value) >= 1 && Number(value) <= 5).length;
  }

  averageScore(survey: SurveyRecord): number {
    const values = Object.values(survey.question_responses || {}).map((value) => Number(value)).filter((value) => value >= 1 && value <= 5);
    if (!values.length) {
      return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(1));
  }

  sectionAverage(survey: SurveyRecord, start: number, endExclusive: number): number {
    const values: number[] = [];
    for (let index = start; index < endExclusive; index += 1) {
      const key = `q${index + 1}`;
      const value = Number(survey.question_responses?.[key]);
      if (value >= 1 && value <= 5) {
        values.push(value);
      }
    }

    if (!values.length) {
      return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(1));
  }

  isViewing(surveyId: number): boolean {
    return this.viewingSurveyId() === surveyId;
  }

  toggleView(surveyId: number): void {
    this.viewingSurveyId.update((current) => current === surveyId ? null : surveyId);
  }

  isDeleting(surveyId: number): boolean {
    return this.deletingSurveyId() === surveyId;
  }

  deleteSurvey(survey: SurveyRecord): void {
    if (!confirm('Delete this completed survey? This action cannot be undone.')) {
      return;
    }

    this.error.set(null);
    this.deletingSurveyId.set(survey.id);
    this.api.deleteSurvey(survey.id).subscribe({
      next: () => {
        this.surveys.update((items) => items.filter((item) => item.id !== survey.id));
        if (this.viewingSurveyId() === survey.id) {
          this.viewingSurveyId.set(null);
        }
        this.deletingSurveyId.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.deletingSurveyId.set(null);
      }
    });
  }

  orderedResponses(survey: SurveyRecord): Array<{ key: string; label: string; value: number }> {
    return Object.entries(survey.question_responses || {})
      .map(([key, value]) => ({
        key,
        label: this.questionLabel(survey, key),
        value: Number(value)
      }))
      .sort((left, right) => this.questionIndex(left.key) - this.questionIndex(right.key));
  }

  private questionLabel(survey: SurveyRecord, key: string): string {
    const index = this.questionIndex(key);
    const questions = survey.survey_type === 'post' ? this.questions().post : this.questions().pre;
    if (index < 0 || index >= questions.length) {
      return `Question ${index + 1}`;
    }

    return questions[index];
  }

  private questionIndex(key: string): number {
    const match = /^q(\d+)$/i.exec(String(key).trim());
    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }

    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value - 1 : Number.MAX_SAFE_INTEGER;
  }
}