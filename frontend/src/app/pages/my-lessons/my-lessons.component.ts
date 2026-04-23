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

    const printWindow = window.open('', '_blank', 'width=1100,height=700');
    if (!printWindow) {
      this.error.set('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    const plan = this.viewingPlan();
    const html = this.buildDepEdDlpHtml(plan, lesson);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }

  async exportPdf(): Promise<void> {
    const lesson = this.viewingLesson();
    if (!lesson) {
      return;
    }

    const plan = this.viewingPlan();
    const html = this.buildDepEdDlpHtml(plan, lesson);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1123px;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      this.error.set('Could not create PDF rendering context.');
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Let iframe auto-size to content height
    iframe.style.height = iframeDoc.body.scrollHeight + 'px';

    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const { jsPDF } = await import('jspdf');

      // 1. Capture the header separately for stamping on every page
      const headerEl = iframeDoc.querySelector('.deped-header') as HTMLElement;
      let headerImg: string | null = null;
      let headerH = 0;
      if (headerEl) {
        const headerCanvas = await html2canvas(headerEl, { scale: 2, useCORS: true, width: 1123, windowWidth: 1123 });
        headerImg = headerCanvas.toDataURL('image/png');
        // Header height in mm (proportional)
        headerH = (headerCanvas.height / headerCanvas.width) * (297 - 10);
      }

      // 2. Capture the main body content
      const bodyEl = iframeDoc.querySelector('.dlp-body') as HTMLElement;
      const targetEl = bodyEl || iframeDoc.body;
      const canvas = await html2canvas(targetEl, { scale: 2, useCORS: true, width: 1123, windowWidth: 1123 });

      const imgData = canvas.toDataURL('image/png');

      // A4 landscape: 297 x 210 mm
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 5;
      const contentWidth = pageWidth - margin * 2;
      const topOffset = headerImg ? headerH + 2 : margin;
      const usableHeight = pageHeight - topOffset - margin;

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('l', 'mm', 'a4');
      let yDrawn = 0;
      let pageNum = 0;

      while (yDrawn < imgHeight) {
        if (pageNum > 0) {
          pdf.addPage();
        }

        // Stamp header on every page
        if (headerImg) {
          pdf.addImage(headerImg, 'PNG', margin, margin, contentWidth, headerH);
        }

        // Draw the content slice
        const srcY = (yDrawn / imgHeight) * canvas.height;
        const srcH = (usableHeight / imgHeight) * canvas.height;

        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(srcH, canvas.height - srcY);
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL('image/png');
          const sliceH = (sliceCanvas.height * imgWidth) / canvas.width;
          pdf.addImage(sliceData, 'PNG', margin, topOffset, imgWidth, sliceH);
        }

        yDrawn += usableHeight;
        pageNum++;
      }

      const fileName = (plan.title || lesson.title || 'Lesson-Plan')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60);
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      this.error.set('PDF export failed. Falling back to print dialog.');
      this.printLesson();
    } finally {
      document.body.removeChild(iframe);
    }
  }

  private buildDepEdDlpHtml(plan: ViewPlan, lesson: LessonRecord): string {
    const e = (v: string) => this.escapeHtml(v || '');
    const nl2br = (v: string) => this.escapeHtml(v || '').replace(/\n/g, '<br>');
    const school = e(this.currentSchool());
    const teacher = e(this.currentTeacher());
    const grade = e(plan.grade || lesson.grade || '');
    const quarter = e(plan.quarter || lesson.quarter || '');
    const subject = e(plan.subject || lesson.subject || '');
    const dateStr = e(this.lessonDateTime(lesson));

    const sealUrl = (typeof globalThis.location?.protocol === 'string' && globalThis.location.protocol === 'file:')
      ? 'deped-seal.png'
      : './deped-seal.png';

    // Format Objectives as Ordered List
    const objectivesList = this.competencyItems();
    const objectivesHtml = objectivesList.length > 0
      ? `<ol style="margin-left: 16px; margin-top: 4px;">${objectivesList.map(obj => `<li>${e(obj)}</li>`).join('')}</ol>`
      : nl2br(plan.competencies);

    // Format Accommodations & Modifications
    const accList = this.accommodationItems();
    const modList = this.modificationItems();
    let supportHtml = '';
    
    if (accList.length > 0 || modList.length > 0) {
      supportHtml += `<div style="margin-top: 8px;">`;
      if (accList.length > 0) {
        supportHtml += `<strong>Accommodations:</strong><ul style="margin-left: 16px; margin-top: 2px; margin-bottom: 4px;">${accList.map(a => `<li>${e(a)}</li>`).join('')}</ul>`;
      }
      if (modList.length > 0) {
        supportHtml += `<strong>Modifications:</strong><ul style="margin-left: 16px; margin-top: 2px; margin-bottom: 0;">${modList.map(m => `<li>${e(m)}</li>`).join('')}</ul>`;
      }
      supportHtml += `</div>`;
    }

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${e(plan.title || lesson.title || 'Daily Lesson Plan')}</title>
<style>
  @page { size: landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; line-height: 1.3; }

  .page-wrapper { width: 100%; }
  .page-wrapper > thead { display: table-header-group; }
  .page-wrapper > thead td { border: none; padding: 0; }
  .page-wrapper > tbody { display: table-row-group; }
  .page-wrapper > tbody > tr > td { border: none; padding: 0; }

  .deped-header { text-align: center; padding-bottom: 4px; }
  .deped-header img.seal { width: 46px; height: 46px; }
  .deped-header .republic { font-family: 'Old English Text MT', 'Times New Roman', serif; font-size: 11pt; font-style: italic; }
  .deped-header .deped-title { font-family: 'Old English Text MT', 'Times New Roman', serif; font-size: 13pt; font-weight: bold; }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 9pt; }
  .info-table td { padding: 1px 4px; border: 1px solid #000; }
  .info-table .highlight { background: #fce4c6; }
  .info-table .logo-cell { width: 46px; text-align: center; vertical-align: middle; }
  .info-table .logo-cell img { width: 38px; }
  .info-table .subject-cell { font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; width: 90px; }

  .dlp-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .dlp-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  .dlp-table .section-label {
    width: 46px; min-width: 46px; max-width: 46px;
    text-align: center; vertical-align: middle;
    padding: 8px 2px;
    font-weight: bold; font-size: 7.5pt;
    line-height: 1.2; text-transform: uppercase;
    writing-mode: vertical-lr;
    transform: rotate(180deg);
  }
  .dlp-table .sub-label { width: 120px; font-weight: bold; font-size: 9pt; vertical-align: top; }
  .dlp-table .content-cell { font-size: 9.5pt; }

  .sig-section { margin-top: 16px; font-size: 10pt; page-break-inside: avoid; }
  .sig-section p { margin-bottom: 22px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<table class="page-wrapper" style="width:100%;border-collapse:collapse;">
<thead><tr><td>
  <div class="deped-header">
    <img class="seal" src="${sealUrl}" alt="DepEd Seal"><br>
    <span class="republic">Republic of the Philippines</span><br>
    <span class="deped-title">Department of Education</span>
  </div>
</td></tr></thead>
<tbody><tr><td>
<div class="dlp-body">
<table class="info-table">
  <tr>
    <td class="logo-cell" rowspan="3"><img src="${sealUrl}" alt=""></td>
    <td class="subject-cell" rowspan="3">${subject}</td>
    <td>School</td><td class="highlight">${school}</td>
    <td>Grade Level</td><td class="highlight">${grade}</td>
    <td>Quarter</td><td class="highlight">${quarter}</td>
  </tr>
  <tr>
    <td>Teacher</td><td class="highlight">${teacher}</td>
    <td>Learning Area</td><td class="highlight">${subject}</td>
    <td colspan="2"></td>
  </tr>
  <tr>
    <td>Teaching Date and Time</td><td class="highlight">${dateStr}</td>
    <td colspan="4"></td>
  </tr>
</table>
<table class="dlp-table">
  <tr>
    <td class="section-label" rowspan="5">I. CURRICULUM CONTENT,<br>STANDARDS AND LESSON<br>COMPETENCIES</td>
    <td class="sub-label">A. Content Standards</td>
    <td class="content-cell">${nl2br(plan.content_standards)}</td>
  </tr>
  <tr><td class="sub-label">B. Performance Standards</td><td class="content-cell">${nl2br(plan.performance_standards)}</td></tr>
  <tr><td class="sub-label">C. Learning Competencies and Objectives</td><td class="content-cell">${objectivesHtml}</td></tr>
  <tr><td class="sub-label">D. Content</td><td class="content-cell"><strong>Topic:</strong> ${e(plan.content || plan.title)}<br><strong>Lesson:</strong> ${e(plan.title)}</td></tr>
  <tr><td class="sub-label">E. Integration</td><td class="content-cell"><strong>Inclusive Education Focus:</strong> ${e(plan.difficulty)}<br>${nl2br(plan.integration)}${supportHtml}</td></tr>
</table>
<table class="dlp-table">
  <tr>
    <td class="section-label">II. LEARNING<br>RESOURCES</td>
    <td class="sub-label">Learning Resources</td>
    <td class="content-cell">${nl2br(plan.resources)}</td>
  </tr>
</table>
<table class="dlp-table">
  <tr>
    <td class="section-label" rowspan="7" style="vertical-align: top; padding-bottom: 20px;">III. TEACHING AND<br>LEARNING PROCEDURE</td>
    <td class="sub-label">A. Activating Prior Knowledge</td>
    <td class="content-cell">${nl2br(plan.prior_knowledge)}</td>
  </tr>
  <tr><td class="sub-label">B. Establishing Lesson Purpose</td><td class="content-cell">${nl2br(plan.lesson_purpose)}</td></tr>
  <tr><td class="sub-label">C. Developing and Deepening Understanding</td><td class="content-cell">${nl2br(plan.developing)}</td></tr>
  <tr><td class="sub-label">D. Making Generalization</td><td class="content-cell">${nl2br(plan.generalization)}</td></tr>
  <tr><td class="sub-label">E. Evaluating Learning</td><td class="content-cell">${nl2br(plan.evaluation)}</td></tr>
  <tr><td class="sub-label">F. Teacher&rsquo;s Remarks</td><td class="content-cell">${nl2br(plan.remarks)}</td></tr>
  <tr><td class="sub-label">G. Reflection</td><td class="content-cell">${nl2br(plan.reflection)}</td></tr>
</table>
<div class="sig-section">
  <p>PREPARED BY: <strong>${teacher}</strong></p>
  <p>REVIEWED BY: ___________________________</p>
  <p>NOTED BY: ___________________________</p>
</div>
</div>
</td></tr></tbody>
</table>
</body>
</html>`;
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

  competencyItems(): string[] {
    const text = this.viewingPlan().competencies || '';
    if (!text) {
      return [];
    }

    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+(?=\d+\.\s)/g, '\n');

    const numberedItems = normalized.match(/\d+\.\s[\s\S]*?(?=(?:\n\d+\.\s)|$)/g);
    const rawItems = (numberedItems && numberedItems.length > 0)
      ? numberedItems
      : this.toItems(normalized, /\r?\n|•|;|\|/g);

    return rawItems
      .map((item) => this.formatObjective(item))
      .filter(Boolean);
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

  private formatObjective(text: string): string {
    const compact = text
      .replace(/^\d+\.\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!compact) {
      return '';
    }

    const professionalCase = compact.charAt(0).toUpperCase() + compact.slice(1);
    if (/[.!?]$/.test(professionalCase)) {
      return professionalCase;
    }

    return `${professionalCase}.`;
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
