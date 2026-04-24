import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { DifficultyCategoryRecord, LessonRecord, ResourceLibraryItem } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-lesson-workbench',
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './lesson-workbench.component.html',
  styleUrl: './lesson-workbench.component.scss'
})
export class LessonWorkbenchComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly models = signal<string[]>([]);
  readonly resourceLibrary = signal<ResourceLibraryItem[]>([]);
  readonly savedLessons = signal<LessonRecord[]>([]);
  readonly selectedReferences = signal<string[]>([]);
  readonly generatedOutput = signal<string>('');
  readonly currentStep = signal(1);
  readonly loading = signal(true);
  readonly generating = signal(false);
  readonly error = signal<string | null>(null);
  readonly allowMultipleDifficulty = signal(false);
  readonly selectedDifficulties = signal<string[]>([]);
  readonly selectedIndicators = signal<string[]>([]);
  readonly customIndicators = signal<string[]>([]);
  readonly customIndicatorDraft = signal('');
  readonly selectedSupports = signal<string[]>([]);
  readonly focusedDifficulty = signal<string | null>(null);
  readonly selectedSubcategories = signal<string[]>([]);

  readonly steps = ['Details', 'Difficulty', 'Indicators', 'Support', 'Review'] as const;
  readonly subjectOptions = ['English', 'Mathematics', 'Science', 'Filipino', 'Araling Panlipunan', 'MAPEH', 'ESP', 'Others'] as const;
  readonly gradeOptions = [
    'ALS', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    '1st Year High', '2nd Year High', '3rd Year High', '4th Year High',
    'Others'
  ] as const;
  readonly quarterOptions = ['Q1', 'Q2', 'Q3', 'Q4', 'Others'] as const;

  readonly otherSubject = signal('');
  readonly otherGrade = signal('');
  readonly otherQuarter = signal('');
  readonly allDifficultyCategories = signal<DifficultyCategoryRecord[]>([]);
  readonly deliveryModes = ['Face-to-face', 'Online', 'Blended', 'Small Group', 'Pull-out Support'] as const;
  private readonly defaultDifficultyOptions = [
    'Difficulty in Displaying Interpersonal Behaviors',
    'Difficulty in Basic Learning and Applying Knowledge',
    'Difficulty in Communication',
    'Difficulty in Mobility',
    'Difficulty in Hearing',
    'Difficulty in Seeing',
    'Difficulty in Remembering / Concentrating',
    'Difficulty in Performing Adaptive Skills',
    'Difficulty in Seeing and Hearing (Deaf-Blindness)',
    'Difficulty in Hearing with Other Disabilities',
    'Difficulty in Communicating — ADHD',
    'Difficulty in Communicating — Autism',
    'Difficulty in Communicating — Tourette Syndrome'
  ] as const;
  readonly difficultyOptions = signal<string[]>([...this.defaultDifficultyOptions]);
  readonly indicatorsFromLibrary = computed(() => {
    const selected = this.selectedDifficulties();
    const all = this.allDifficultyCategories();
    const result = new Set<string>();

    selected.forEach((name) => {
      const cat = all.find((c) => c.name === name);
      if (cat) {
        cat.observable_characteristics.forEach((i) => result.add(i));
      }
    });

    return Array.from(result);
  });
  readonly indicatorOptions = []; // Kept for legacy if needed, but we'll use indicatorsFromLibrary
  readonly difficultySubcategoryMap: Record<string, string[]> = {}; // Legacy, kept for safety or removed if unused
  readonly activeDifficultyForSubcategories = computed(() => {
    const focused = this.focusedDifficulty();
    if (focused && this.selectedDifficulties().includes(focused)) {
      return focused;
    }

    return this.selectedDifficulties()[0] ?? null;
  });
  readonly activeSubcategories = computed(() => {
    const activeName = this.activeDifficultyForSubcategories();
    if (!activeName) {
      return [] as string[];
    }

    const cat = this.allDifficultyCategories().find((c) => c.name === activeName);
    return cat?.subcategories ?? [];
  });

  readonly form = this.fb.group({
    subject: ['', Validators.required],
    grade: ['', Validators.required],
    quarter: ['', Validators.required],
    title: ['', Validators.required],
    objectives: ['', Validators.required],
    senCount: ['', [Validators.required, Validators.min(0)]],
    difficulty: ['', Validators.required],
    indicators: ['', Validators.required],
    supportTypes: ['', Validators.required],
    subcategories: [''],
    customSupport: [''],
    deliveryMode: ['Face-to-face', Validators.required],
    reviewedBy: ['Department Head'],
    notedBy: ['School Principal'],
    model: ['', Validators.required]
  });
  readonly supportChecklist = [
    'Accommodations',
    'Modifications',
    'Differentiated Activities',
    'Adaptive Assessment Methods',
    'Behavior Support Strategies',
    'Scaffolding / ZPD-aligned Support',
    'Resource Recommendations'
  ] as const;

  ngOnInit(): void {
    forkJoin({
      models: this.api.getModels(),
      library: this.api.getResourceLibrary(),
      lessons: this.api.getLessons(),
      difficulties: this.api.getDifficultyCategories()
    }).subscribe({
      next: ({ models, library, lessons, difficulties }) => {
        this.models.set(models);
        this.resourceLibrary.set(library);
        this.savedLessons.set(lessons);
        this.setDifficultyOptions(difficulties);
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

  private setDifficultyOptions(categories: DifficultyCategoryRecord[]): void {
    this.allDifficultyCategories.set(categories);
    const names = categories.map((item) => String(item.name || '').trim()).filter(Boolean);
    this.difficultyOptions.set(names.length > 0 ? names : [...this.defaultDifficultyOptions]);
  }

  toggleDifficulty(difficulty: string, checked: boolean): void {
    this.selectedDifficulties.update((current) => {
      const next = new Set(current);
      if (checked) {
        if (this.allowMultipleDifficulty()) {
          if (next.size >= 3) {
            return Array.from(next);
          }
          next.add(difficulty);
        } else {
          return [difficulty];
        }
      } else {
        next.delete(difficulty);
      }

      return Array.from(next);
    });

    if (checked) {
      this.focusedDifficulty.set(difficulty);
    } else if (this.focusedDifficulty() === difficulty) {
      this.focusedDifficulty.set(this.selectedDifficulties()[0] ?? null);
    }
    this.selectedSubcategories.update((current) => {
      const valid = new Set(this.activeSubcategories());
      return current.filter((item) => valid.has(item));
    });

    this.syncDifficultyControl();
    this.syncSubcategoriesControl();
  }

  onMultipleDifficultyToggle(checked: boolean): void {
    this.allowMultipleDifficulty.set(checked);
    if (!checked && this.selectedDifficulties().length > 1) {
      this.selectedDifficulties.set([this.selectedDifficulties()[0]]);
    }
    this.syncDifficultyControl();
  }

  toggleSubcategory(subcategory: string, checked: boolean): void {
    this.selectedSubcategories.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(subcategory);
      } else {
        next.delete(subcategory);
      }
      return Array.from(next);
    });

    this.syncSubcategoriesControl();
  }

  toggleIndicator(indicator: string, checked: boolean): void {
    this.selectedIndicators.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(indicator);
      } else {
        next.delete(indicator);
      }
      return Array.from(next);
    });

    this.syncIndicatorsControl();
  }

  addCustomIndicator(): void {
    const value = this.customIndicatorDraft().trim();
    if (!value) {
      return;
    }

    this.customIndicators.update((current) => current.includes(value) ? current : [...current, value]);
    this.customIndicatorDraft.set('');
    this.syncIndicatorsControl();
  }

  removeCustomIndicator(indicator: string): void {
    this.customIndicators.update((current) => current.filter((item) => item !== indicator));
    this.syncIndicatorsControl();
  }

  setCustomIndicatorDraft(value: string): void {
    this.customIndicatorDraft.set(value);
  }

  toggleSupport(support: string, checked: boolean): void {
    this.selectedSupports.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(support);
      } else {
        next.delete(support);
      }
      return Array.from(next);
    });

    this.syncSupportTypesControl();
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

  goToStep(step: number): void {
    if (step < 1 || step > this.steps.length) {
      return;
    }

    if (step > this.currentStep() && !this.isStepValid(this.currentStep())) {
      this.markStepTouched(this.currentStep());
      return;
    }

    this.currentStep.set(step);
  }

  nextStep(): void {
    if (!this.isStepValid(this.currentStep())) {
      this.markStepTouched(this.currentStep());
      return;
    }

    this.currentStep.update((step) => Math.min(this.steps.length, step + 1));
  }

  prevStep(): void {
    this.currentStep.update((step) => Math.max(1, step - 1));
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        const valid = this.controlsValid(['subject', 'grade', 'quarter', 'title', 'objectives', 'senCount']);
        if (!valid) return false;
        
        const raw = this.form.getRawValue();
        if (raw.subject === 'Others' && !this.otherSubject().trim()) return false;
        if (raw.grade === 'Others' && !this.otherGrade().trim()) return false;
        if (raw.quarter === 'Others' && !this.otherQuarter().trim()) return false;
        
        return true;
      case 2:
        return this.selectedDifficulties().length > 0;
      case 3:
        return this.selectedIndicators().length + this.customIndicators().length > 0;
      case 4:
        return this.selectedSupports().length > 0 && this.controlsValid(['deliveryMode']);
      case 5:
        return this.controlsValid(['model']);
      default:
        return false;
    }
  }

  private controlsValid(controlNames: Array<keyof typeof this.form.controls>): boolean {
    return controlNames.every((name) => this.form.controls[name].valid);
  }

  private markStepTouched(step: number): void {
    const touch = (names: Array<keyof typeof this.form.controls>) => names.forEach((name) => this.form.controls[name].markAsTouched());
    if (step === 1) {
      touch(['subject', 'grade', 'quarter', 'title', 'objectives', 'senCount']);
    }
    if (step === 4) {
      touch(['deliveryMode']);
    }
  }

  stepProgress(stepIndex: number): number {
    if (this.currentStep() > stepIndex + 1) {
      return 100;
    }

    if (this.currentStep() === stepIndex + 1) {
      return 100;
    }

    return 0;
  }

  generate(): void {
    this.syncDifficultyControl();
    this.syncIndicatorsControl();
    this.syncSupportTypesControl();
    this.syncSubcategoriesControl();

    if (!this.isStepValid(1) || !this.isStepValid(2) || !this.isStepValid(3) || !this.isStepValid(4) || !this.isStepValid(5)) {
      this.form.markAllAsTouched();
      return;
    }

    this.generating.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const lessonData = {
      subject: raw.subject === 'Others' ? this.otherSubject() : raw.subject,
      grade: raw.grade === 'Others' ? this.otherGrade() : raw.grade,
      quarter: raw.quarter === 'Others' ? this.otherQuarter() : raw.quarter,
      title: raw.title,
      objectives: raw.objectives,
      difficulty: raw.difficulty,
      indicators: raw.indicators,
      supportTypes: raw.supportTypes,
      subcategories: raw.subcategories,
      customSupport: raw.customSupport,
      deliveryMode: raw.deliveryMode
    };

    this.api.generateLessonPlan({
      model: raw.model,
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
            this.notificationService.addNotification(`Lesson plan "${response.lesson?.title || raw.title}" was generated.`);
            this.router.navigate(['/my-lessons'], {
              queryParams: { view: response.lesson.id }
            });
          } else {
            this.notificationService.addNotification(`Lesson plan "${raw.title}" was generated.`);
            this.reloadLessons();
            this.router.navigate(['/my-lessons']);
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
    const subject = this.subjectOptions.includes(lesson.subject as any) ? lesson.subject : 'Others';
    const grade = this.gradeOptions.includes(lesson.grade as any) ? lesson.grade : 'Others';
    const quarter = this.quarterOptions.includes(lesson.quarter as any) ? lesson.quarter : 'Others';

    if (subject === 'Others') this.otherSubject.set(lesson.subject);
    if (grade === 'Others') this.otherGrade.set(lesson.grade);
    if (quarter === 'Others') this.otherQuarter.set(lesson.quarter);

    this.form.patchValue({
      subject,
      grade,
      quarter,
      title: lesson.title,
      objectives: lesson.objectives,
      difficulty: lesson.difficulty,
      indicators: lesson.indicators,
      supportTypes: lesson.support_types,
      subcategories: String((lesson as { subcategories?: string }).subcategories || ''),
      customSupport: lesson.custom_support,
      deliveryMode: lesson.delivery_mode,
      model: lesson.ai_model_used || this.form.controls.model.value
    });

    const parsedDifficulties = String(lesson.difficulty || '').split('|').map((item) => item.trim()).filter(Boolean);
    this.selectedDifficulties.set(parsedDifficulties.length ? parsedDifficulties : []);
    this.allowMultipleDifficulty.set(parsedDifficulties.length > 1);
    this.focusedDifficulty.set(parsedDifficulties[0] ?? null);

    const parsedSubcategories = String((lesson as { subcategories?: string }).subcategories || '')
      .split(' | ')
      .map((item) => item.trim())
      .filter(Boolean);
    this.selectedSubcategories.set(parsedSubcategories);

    const parsedIndicators = String(lesson.indicators || '').split(' | ').map((item) => item.trim()).filter(Boolean);
    const knownIndicatorSet = new Set(this.indicatorOptions);
    this.selectedIndicators.set(parsedIndicators.filter((item) => knownIndicatorSet.has(item as typeof this.indicatorOptions[number])));
    this.customIndicators.set(parsedIndicators.filter((item) => !knownIndicatorSet.has(item as typeof this.indicatorOptions[number])));

    const parsedSupports = String(lesson.support_types || '').split(',').map((item) => item.trim()).filter(Boolean);
    this.selectedSupports.set(parsedSupports);

    this.selectedReferences.set(lesson.reference_docs_used ?? []);
    this.generatedOutput.set(lesson.generated_output ?? '');
    this.currentStep.set(1);
  }

  referenceTitle(fileName: string): string {
    const item = this.resourceLibrary().find((entry) => entry.file_name === fileName);
    return item?.title || fileName;
  }

  private syncDifficultyControl(): void {
    this.form.controls.difficulty.setValue(this.selectedDifficulties().join(' | '));
  }

  private syncIndicatorsControl(): void {
    const allIndicators = [...this.selectedIndicators(), ...this.customIndicators()];
    this.form.controls.indicators.setValue(allIndicators.join(' | '));
  }

  private syncSupportTypesControl(): void {
    this.form.controls.supportTypes.setValue(this.selectedSupports().join(', '));
  }

  private syncSubcategoriesControl(): void {
    this.form.controls.subcategories.setValue(this.selectedSubcategories().join(' | '));
  }

  private reloadLessons(): void {
    this.api.getLessons().subscribe({
      next: (lessons) => this.savedLessons.set(lessons),
      error: (error) => this.error.set(this.api.describeError(error))
    });
  }
}
