import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LessonRecord } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

type ViewPlan = {
  content_standards: string;
  performance_standards: string;
  competencies: string;
  content: string;
  integration: string;
  resources: string;
  prior_knowledge: string;
  lesson_purpose: string;
  developing: string;
  generalization: string;
  evaluation: string;
  accommodations: string;
  modifications: string;
  remarks: string;
  reflection: string;
  custom_support: string;
  observations: string;
  subject: string;
  grade: string;
  quarter: string;
  title: string;
  difficulty: string;
  indicators: string;
  support_types: string;
  delivery_mode: string;
  subcategories: string;
};

const emptyViewPlan = (): ViewPlan => ({
  content_standards: '',
  performance_standards: '',
  competencies: '',
  content: '',
  integration: '',
  resources: '',
  prior_knowledge: '',
  lesson_purpose: '',
  developing: '',
  generalization: '',
  evaluation: '',
  accommodations: '',
  modifications: '',
  remarks: '',
  reflection: '',
  custom_support: '',
  observations: '',
  subject: '',
  grade: '',
  quarter: '',
  title: '',
  difficulty: '',
  indicators: '',
  support_types: '',
  delivery_mode: '',
  subcategories: ''
});

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lessons = signal<LessonRecord[]>([]);
  readonly modalMode = signal<'edit' | null>(null);
  readonly selectedLesson = signal<LessonRecord | null>(null);
  readonly viewingLesson = signal<LessonRecord | null>(null);
  readonly viewingPlan = signal<ViewPlan>(emptyViewPlan());
  readonly currentTeacher = signal('Janice D. Quinones');
  readonly currentSchool = signal('San Felipe National High School · Basud, Camarines Norte');
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
    this.readAuthProfile();

    this.api.getLessons().subscribe({
      next: (lessons) => {
        this.lessons.set(lessons);
        this.openViewFromQuery(lessons);
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
    this.viewingLesson.set(lesson);
    this.viewingPlan.set(this.buildViewPlan(lesson));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: lesson.id },
      queryParamsHandling: 'merge'
    });
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

  closeView(): void {
    this.viewingLesson.set(null);
    this.viewingPlan.set(emptyViewPlan());
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null },
      queryParamsHandling: 'merge'
    });
  }

  printLesson(): void {
    const lesson = this.viewingLesson();
    if (!lesson) {
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760');
    if (!printWindow) {
      this.error.set('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    const escapedTitle = this.escapeHtml(lesson.title || 'Daily Lesson Plan');
    const plan = this.viewingPlan();
    const escapedOutput = this.escapeHtml(this.printableText(plan)).replace(/\n/g, '<br>');
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapedTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #1f2937; }
            h1 { margin: 0 0 12px; font-size: 24px; }
            .meta { margin-bottom: 16px; color: #334155; }
            .content { border: 1px solid #dbe3dd; border-radius: 10px; padding: 16px; line-height: 1.5; }
            @media print { body { padding: 0; } .content { border: none; padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${escapedTitle}</h1>
          <div class="meta">${this.escapeHtml(this.currentSchool())} · ${this.escapeHtml(this.currentTeacher())}</div>
          <div class="content">${escapedOutput}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  exportPdf(): void {
    this.printLesson();
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

  private openViewFromQuery(lessons: LessonRecord[]): void {
    const idFromQuery = Number(this.route.snapshot.queryParamMap.get('view'));
    if (!Number.isFinite(idFromQuery) || idFromQuery <= 0) {
      return;
    }

    const match = lessons.find((lesson) => lesson.id === idFromQuery);
    if (match) {
      this.viewingLesson.set(match);
      this.viewingPlan.set(this.buildViewPlan(match));
    }
  }

  detailLines(text: string): string[] {
    return this.toItems(text, /\r?\n|•|;|\|/g);
  }

  lessonDateTime(lesson: LessonRecord | null): string {
    if (!lesson?.created_at) {
      return 'Not specified';
    }

    const date = new Date(lesson.created_at);
    if (Number.isNaN(date.getTime())) {
      return 'Not specified';
    }

    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  accommodationItems(): string[] {
    const direct = this.supportItems(this.viewingPlan().accommodations || '');
    if (direct.length > 0) {
      return direct.filter((item) => !/^accommodations?:?$/i.test(item));
    }

    const notes = this.viewingPlan().custom_support || '';
    const items = this.supportItems(notes);
    const keyword = /(modify|reduced|simplified|fewer|shorten|alternative|focus)/i;
    return items.filter((item) => !keyword.test(item));
  }

  modificationItems(): string[] {
    const direct = this.supportItems(this.viewingPlan().modifications || '');
    if (direct.length > 0) {
      return direct.filter((item) => !/^modifications?:?$/i.test(item));
    }

    const notes = this.viewingPlan().custom_support || '';
    const items = this.supportItems(notes);
    const keyword = /(modify|reduced|simplified|fewer|shorten|alternative|focus)/i;
    return items.filter((item) => keyword.test(item));
  }

  private readAuthProfile(): void {
    const raw = window.localStorage.getItem('inspire-demo-auth');
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { name?: string; school?: string };
      this.currentTeacher.set(parsed.name || this.currentTeacher());
      this.currentSchool.set(parsed.school || this.currentSchool());
    } catch {
      // Keep defaults when local auth payload is unavailable.
    }
  }

  private buildViewPlan(lesson: LessonRecord): ViewPlan {
    const parsed = this.normalizeParsed(lesson.generated_parsed) || this.tryParseGeneratedJson(lesson.generated_output);
    const parsedText = this.parseFormattedLessonPlan(lesson.generated_output);

    return {
      content_standards: this.readPlanField(parsed, 'content_standards', parsedText.content_standards || lesson.objectives),
      performance_standards: this.readPlanField(parsed, 'performance_standards', parsedText.performance_standards || ''),
      competencies: this.readPlanField(parsed, 'competencies', parsedText.competencies || lesson.objectives),
      content: this.readPlanField(parsed, 'content', parsedText.content || lesson.title),
      integration: this.readPlanField(parsed, 'integration', parsedText.integration || ''),
      resources: this.readPlanField(parsed, 'resources', parsedText.resources || ''),
      prior_knowledge: this.readPlanField(parsed, 'prior_knowledge', parsedText.prior_knowledge || ''),
      lesson_purpose: this.readPlanField(parsed, 'lesson_purpose', parsedText.lesson_purpose || ''),
      developing: this.readPlanField(parsed, 'developing', parsedText.developing || ''),
      generalization: this.readPlanField(parsed, 'generalization', parsedText.generalization || ''),
      evaluation: this.readPlanField(parsed, 'evaluation', parsedText.evaluation || ''),
      accommodations: this.readPlanFieldAny(parsed, ['accommodations', 'accommodation', 'accommodation_plan', 'accommodation_strategies'], parsedText.accommodations || ''),
      modifications: this.readPlanFieldAny(parsed, ['modifications', 'modification', 'modification_plan', 'modification_strategies'], parsedText.modifications || ''),
      remarks: this.readPlanField(parsed, 'remarks', parsedText.remarks || ''),
      reflection: this.readPlanField(parsed, 'reflection', parsedText.reflection || ''),
      custom_support: this.readPlanFieldAny(parsed, ['custom_support', 'customSupport', 'support_plan', 'support_notes', 'observed_manifestations'], parsedText.custom_support || lesson.custom_support || ''),
      observations: this.readPlanField(parsed, 'observations', parsedText.observations || ''),
      subject: this.readPlanField(parsed, 'subject', parsedText.subject || lesson.subject),
      grade: this.readPlanField(parsed, 'grade', parsedText.grade || lesson.grade),
      quarter: this.readPlanField(parsed, 'quarter', parsedText.quarter || lesson.quarter),
      title: this.readPlanField(parsed, 'title', parsedText.title || lesson.title),
      difficulty: this.readPlanField(parsed, 'difficulty', parsedText.difficulty || lesson.difficulty),
      indicators: this.readPlanField(parsed, 'indicators', lesson.indicators),
      support_types: this.readPlanField(parsed, 'support_types', lesson.support_types),
      delivery_mode: this.readPlanField(parsed, 'delivery_mode', lesson.delivery_mode),
      subcategories: this.readPlanField(parsed, 'subcategories', lesson.subcategories || '')
    };
  }

  private parseFormattedLessonPlan(text: string | undefined): Partial<ViewPlan> {
    if (!text) {
      return {};
    }

    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    const getLineValue = (label: string): string => {
      const line = lines.find((item) => item.trim().startsWith(label));
      if (!line) {
        return '';
      }
      return line.replace(label, '').trim();
    };

    const gradeQuarterLine = lines.find((item) => item.includes('Grade Level:') && item.includes('Quarter:')) || '';
    const gradeMatch = gradeQuarterLine.match(/Grade Level:\s*([^\s].*?)\s+Quarter:/);
    const quarterMatch = gradeQuarterLine.match(/Quarter:\s*(.+)$/);

    const pullSection = (startLabel: string, endLabels: string[]): string => {
      const startIndex = lines.findIndex((item) => item.trim() === startLabel);
      if (startIndex < 0) {
        return '';
      }

      let endIndex = lines.length;
      for (let index = startIndex + 1; index < lines.length; index += 1) {
        const current = lines[index].trim();
        if (endLabels.includes(current)) {
          endIndex = index;
          break;
        }
      }

      return lines
        .slice(startIndex + 1, endIndex)
        .join('\n')
        .replace(/^[\s\n]+|[\s\n]+$/g, '');
    };

    const cleanProcedureSection = (value: string): string => value
      .replace(/^Duration:\s*.*$/gim, '')
      .replace(/^Teacher's Activity:\s*$/gim, '')
      .replace(/^Adaptive Assessment Methods:\s*$/gim, '')
      .replace(/^[\s\n]+|[\s\n]+$/g, '');

    const contentBlock = pullSection('D. Content', ['E. Integration']);
    const topicMatch = contentBlock.match(/Topic:\s*(.+)/i);
    const lessonTitleMatch = contentBlock.match(/Lesson:\s*(.+)/i);

    const integrationBlock = pullSection('E. Integration', [
      'F. Support Plan (Accommodations and Modifications)',
      'F. Observed Manifestations & Accommodations',
      '═══════════════════════════════════════════════════════════════'
    ]);
    const focusMatch = integrationBlock.match(/Inclusive Education Focus:\s*(.+)/i);

    const supportPlanBlock = pullSection('F. Support Plan (Accommodations and Modifications)', ['═══════════════════════════════════════════════════════════════']);
    const legacySupportBlock = pullSection('F. Observed Manifestations & Accommodations', ['═══════════════════════════════════════════════════════════════']);

    const pullSupportDetail = (block: string, startLabel: string, endLabels: string[]): string => {
      if (!block) {
        return '';
      }

      const blockLines = block.split('\n');
      const startIndex = blockLines.findIndex((item) => item.trim().startsWith(startLabel));
      if (startIndex < 0) {
        return '';
      }

      let endIndex = blockLines.length;
      for (let index = startIndex + 1; index < blockLines.length; index += 1) {
        const current = blockLines[index].trim();
        if (endLabels.some((label) => current.startsWith(label))) {
          endIndex = index;
          break;
        }
      }

      return blockLines
        .slice(startIndex + 1, endIndex)
        .join('\n')
        .replace(/^[\s\n]+|[\s\n]+$/g, '');
    };

    const parsedAccommodations = pullSupportDetail(supportPlanBlock, 'Accommodations:', ['Modifications:', 'Observed Manifestations & Additional Notes:']);
    const parsedModifications = pullSupportDetail(supportPlanBlock, 'Modifications:', ['Observed Manifestations & Additional Notes:']);
    const parsedSupportNotes = pullSupportDetail(supportPlanBlock, 'Observed Manifestations & Additional Notes:', []);
    const fallbackSupportBlock = legacySupportBlock || supportPlanBlock;

    return {
      subject: getLineValue('Learning Area:'),
      grade: (gradeMatch?.[1] || '').trim(),
      quarter: (quarterMatch?.[1] || '').trim(),
      content_standards: pullSection('A. Content Standards', ['B. Performance Standards']),
      performance_standards: pullSection('B. Performance Standards', ['C. Learning Competencies and Objectives']),
      competencies: pullSection('C. Learning Competencies and Objectives', ['D. Content']),
      content: (topicMatch?.[1] || '').trim() || contentBlock,
      title: (lessonTitleMatch?.[1] || '').trim(),
      integration: integrationBlock.replace(/^Inclusive Education Focus:\s*.*$/gim, '').trim(),
      difficulty: (focusMatch?.[1] || '').trim(),
      accommodations: parsedAccommodations || fallbackSupportBlock,
      modifications: parsedModifications,
      custom_support: parsedSupportNotes || fallbackSupportBlock,
      resources: pullSection('II. LEARNING RESOURCES', ['═══════════════════════════════════════════════════════════════', 'III. TEACHING AND LEARNING PROCEDURE']),
      prior_knowledge: cleanProcedureSection(pullSection('A. Activating Prior Knowledge', ['B. Establishing Lesson Purpose'])),
      lesson_purpose: cleanProcedureSection(pullSection('B. Establishing Lesson Purpose', ['C. Developing and Deepening Understanding'])),
      developing: cleanProcedureSection(pullSection('C. Developing and Deepening Understanding', ['D. Making Generalization'])),
      generalization: cleanProcedureSection(pullSection('D. Making Generalization', ['E. Evaluating Learning'])),
      evaluation: cleanProcedureSection(pullSection('E. Evaluating Learning', ['F. Teacher\'s Remarks'])),
      remarks: pullSection('F. Teacher\'s Remarks', ['G. Reflection']),
      reflection: pullSection('G. Reflection', ['═══════════════════════════════════════════════════════════════', 'PREPARED BY:'])
    };
  }

  private normalizeParsed(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private tryParseGeneratedJson(text: string | undefined): Record<string, unknown> | null {
    if (!text) {
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      return this.normalizeParsed(parsed);
    } catch {
      return null;
    }
  }

  private readPlanField(source: Record<string, unknown> | null, key: string, fallback: string): string {
    const value = source?.[key];
    return typeof value === 'string' ? value : fallback;
  }

  private readPlanFieldAny(source: Record<string, unknown> | null, keys: string[], fallback: string): string {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return fallback;
  }

  private toItems(text: string, splitter: RegExp): string[] {
    if (!text) {
      return [];
    }

    return text
      .split(splitter)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private supportItems(text: string): string[] {
    if (!text) {
      return [];
    }

    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+(?=\d+\.\s)/g, '\n');

    const numberedItems = normalized.match(/\d+\.\s[\s\S]*?(?=(?:\n\d+\.\s)|$)/g);
    if (numberedItems && numberedItems.length > 0) {
      return numberedItems
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return this.toItems(normalized, /\r?\n|;|\|/g);
  }

  private printableText(plan: ViewPlan): string {
    return [
      'DAILY LESSON PLAN',
      '',
      `School: ${this.currentSchool()}`,
      `Teacher: ${this.currentTeacher()}`,
      `Grade Level: ${plan.grade || 'N/A'}   Quarter: ${plan.quarter || 'N/A'}`,
      `Learning Area: ${plan.subject || 'N/A'}`,
      '',
      'I. CURRICULUM CONTENT, STANDARDS AND LESSON COMPETENCIES',
      `A. Content Standards: ${plan.content_standards || 'N/A'}`,
      `B. Performance Standards: ${plan.performance_standards || 'N/A'}`,
      `C. Learning Competencies and Objectives: ${plan.competencies || 'N/A'}`,
      `D. Content: ${plan.content || 'N/A'}`,
      `E. Integration: ${plan.integration || 'N/A'}`,
      '',
      'II. LEARNING RESOURCES',
      plan.resources || 'N/A',
      '',
      'III. TEACHING AND LEARNING PROCEDURE',
      `A. Activating Prior Knowledge: ${plan.prior_knowledge || 'N/A'}`,
      `B. Establishing Lesson Purpose: ${plan.lesson_purpose || 'N/A'}`,
      `C. Developing and Deepening Understanding: ${plan.developing || 'N/A'}`,
      `D. Making Generalization: ${plan.generalization || 'N/A'}`,
      `E. Evaluating Learning: ${plan.evaluation || 'N/A'}`,
      `Accommodations: ${plan.accommodations || 'N/A'}`,
      `Modifications: ${plan.modifications || 'N/A'}`,
      `F. Teacher's Remarks: ${plan.remarks || 'N/A'}`,
      `G. Reflection: ${plan.reflection || 'N/A'}`
    ].join('\n');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
