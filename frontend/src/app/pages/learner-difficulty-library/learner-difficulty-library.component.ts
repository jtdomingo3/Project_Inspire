import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DifficultyCategoryRecord } from '../../core/models/inspire-api.models';
import { AuthService } from '../../core/services/auth.service';
import { InspireApiService } from '../../core/services/inspire-api.service';

interface DifficultyCategory {
  id: number;
  title: string;
  summary: string;
  indicators: string[];
  tips: string[];
}

@Component({
  standalone: true,
  selector: 'app-learner-difficulty-library',
  imports: [CommonModule, FormsModule],
  templateUrl: './learner-difficulty-library.component.html',
  styleUrl: './learner-difficulty-library.component.scss'
})
export class LearnerDifficultyLibraryComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly auth = inject(AuthService);

  readonly categories = signal<DifficultyCategory[]>([]);
  readonly selected = signal<DifficultyCategory | null>(null);
  readonly addModalOpen = signal(false);
  readonly editMode = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly canManage = signal(false);

  draftTitle = '';
  draftSummary = '';
  draftIndicators = '';
  draftTips = '';

  ngOnInit(): void {
    this.canManage.set(this.auth.getRole() === 'admin');
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getDifficultyCategories().subscribe({
      next: (records) => {
        const mapped = records.map((record) => this.toViewModel(record));
        this.categories.set(mapped);
        this.selected.set(mapped[0] ?? null);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  selectCategory(category: DifficultyCategory): void {
    this.selected.set(category);
  }

  openAddModal(): void {
    this.editMode.set(false);
    this.editingId.set(null);
    this.resetDraft();
    this.addModalOpen.set(true);
  }

  openEditModal(category: DifficultyCategory): void {
    this.editMode.set(true);
    this.editingId.set(category.id);
    this.draftTitle = category.title;
    this.draftSummary = category.summary;
    this.draftIndicators = category.indicators.join('\n');
    this.draftTips = category.tips.join('\n');
    this.addModalOpen.set(true);
  }

  closeAddModal(): void {
    this.addModalOpen.set(false);
    this.editMode.set(false);
    this.editingId.set(null);
    this.resetDraft();
  }

  saveDifficulty(): void {
    const title = this.draftTitle.trim();
    const summary = this.draftSummary.trim();
    const indicators = this.parseList(this.draftIndicators);
    const tips = this.parseList(this.draftTips);
    if (!title || !summary || indicators.length === 0 || tips.length === 0) {
      this.error.set('Title, summary, indicators, and tips are required.');
      return;
    }

    this.saving.set(true);
    this.api.saveDifficultyCategory({
      id: this.editingId() || undefined,
      name: title,
      description: summary,
      observable_characteristics: indicators,
      accommodation_tips: tips.join('\n'),
      has_subcategories: false
    }).subscribe({
      next: ({ category }) => {
        const mapped = this.toViewModel(category);
        this.categories.update((current) => {
          const without = current.filter((item) => item.id !== mapped.id);
          const next = [...without, mapped].sort((a, b) => a.id - b.id);
          return next;
        });
        this.selected.set(mapped);
        this.saving.set(false);
        this.error.set(null);
        this.closeAddModal();
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.saving.set(false);
      }
    });
  }

  deleteDifficulty(category: DifficultyCategory): void {
    const confirmed = window.confirm(`Delete "${category.title}"?`);
    if (!confirmed) {
      return;
    }

    this.api.deleteDifficultyCategory(category.id).subscribe({
      next: () => {
        this.categories.update((current) => current.filter((item) => item.id !== category.id));
        const remaining = this.categories();
        this.selected.set(remaining[0] ?? null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
      }
    });
  }

  private toViewModel(record: DifficultyCategoryRecord): DifficultyCategory {
    return {
      id: record.id,
      title: record.name,
      summary: record.description || '',
      indicators: record.observable_characteristics ?? [],
      tips: this.parseList(record.accommodation_tips || '')
    };
  }

  private parseList(value: string): string[] {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private resetDraft(): void {
    this.draftTitle = '';
    this.draftSummary = '';
    this.draftIndicators = '';
    this.draftTips = '';
  }
}
