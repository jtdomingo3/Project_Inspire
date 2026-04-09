import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ResourceLibraryItem } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-reference-library',
  imports: [CommonModule, FormsModule],
  templateUrl: './reference-library.component.html',
  styleUrl: './reference-library.component.scss'
})
export class ReferenceLibraryComponent implements OnInit {
  private readonly api = inject(InspireApiService);

  readonly resources = signal<ResourceLibraryItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly activeCategory = signal<'All' | 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References'>('All');

  readonly categories: Array<'All' | 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References'> = [
    'All',
    'Strategies',
    'Tips',
    'Templates',
    'Videos',
    'References'
  ];

  readonly filteredResources = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeCategory();

    return this.resources().filter((resource) => {
      const matchesCategory = category === 'All' || resource.category === category;
      const haystack = `${resource.title} ${resource.description} ${resource.file_name}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });
  });

  readonly editModalOpen = signal(false);
  readonly uploadModalOpen = signal(false);
  readonly selectedItem = signal<ResourceLibraryItem | null>(null);

  editTitle = '';
  editDescription = '';
  editCategory: 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References' = 'References';

  uploadTitle = '';
  uploadDescription = '';
  uploadCategory: 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References' = 'References';
  uploadFile: File | null = null;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getResourceLibrary().subscribe({
      next: (items) => {
        this.resources.set(items);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error) => {
        this.error.set(this.api.describeError(error));
        this.loading.set(false);
      }
    });
  }

  setCategory(category: 'All' | 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References'): void {
    this.activeCategory.set(category);
  }

  openEdit(item: ResourceLibraryItem): void {
    this.selectedItem.set(item);
    this.editTitle = item.title;
    this.editDescription = item.description;
    this.editCategory = this.normalizeCategory(item.category);
    this.editModalOpen.set(true);
  }

  closeEdit(): void {
    this.editModalOpen.set(false);
    this.selectedItem.set(null);
  }

  saveEdit(): void {
    const item = this.selectedItem();
    if (!item) {
      return;
    }

    const title = this.editTitle.trim();
    const description = this.editDescription.trim();
    if (!title || !description) {
      this.error.set('Title and description are required.');
      return;
    }

    this.saving.set(true);
    this.api.updateResourceLibraryItem(item.file_name, {
      title,
      description,
      category: this.editCategory
    }).subscribe({
      next: ({ item: updated }) => {
        this.resources.update((current) => current.map((existing) => existing.id === updated.id ? updated : existing));
        this.saving.set(false);
        this.error.set(null);
        this.closeEdit();
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(this.api.describeError(error));
      }
    });
  }

  openUpload(): void {
    this.uploadModalOpen.set(true);
  }

  closeUpload(): void {
    this.uploadModalOpen.set(false);
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadCategory = 'References';
    this.uploadFile = null;
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] || null;

    if (this.uploadFile && !this.uploadTitle.trim()) {
      this.uploadTitle = this.uploadFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    }
  }

  uploadReference(): void {
    if (!this.uploadFile) {
      this.error.set('Select a PDF or DOCX file first.');
      return;
    }

    const title = this.uploadTitle.trim();
    const description = this.uploadDescription.trim();
    if (!title || !description) {
      this.error.set('Title and description are required for uploaded references.');
      return;
    }

    this.uploading.set(true);
    this.readFileAsBase64(this.uploadFile).then((contentBase64) => {
      this.api.uploadReference({
        fileName: this.uploadFile?.name || '',
        contentBase64,
        title,
        description,
        category: this.uploadCategory
      }).subscribe({
        next: ({ item }) => {
          this.resources.update((current) => {
            const withoutExisting = current.filter((existing) => existing.id !== item.id);
            return [item, ...withoutExisting];
          });
          this.uploading.set(false);
          this.error.set(null);
          this.closeUpload();
        },
        error: (error) => {
          this.uploading.set(false);
          this.error.set(this.api.describeError(error));
        }
      });
    }).catch((error) => {
      this.uploading.set(false);
      this.error.set(String(error));
    });
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selected file.'));
      reader.readAsDataURL(file);
    });
  }

  private normalizeCategory(value: string): 'Strategies' | 'Tips' | 'Templates' | 'Videos' | 'References' {
    if (value === 'Strategies' || value === 'Tips' || value === 'Templates' || value === 'Videos' || value === 'References') {
      return value;
    }

    return 'References';
  }
}