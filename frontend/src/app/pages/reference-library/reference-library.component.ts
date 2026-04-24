import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ResourceLibraryItem } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

@Component({
  standalone: true,
  selector: 'app-reference-library',
  imports: [CommonModule, FormsModule],
  templateUrl: './reference-library.component.html',
  styleUrl: './reference-library.component.scss'
})
export class ReferenceLibraryComponent implements OnInit, OnDestroy {
  private readonly api = inject(InspireApiService);
  private readonly sanitizer = inject(DomSanitizer);
  @ViewChild('docxPreviewHost') private docxPreviewHost?: ElementRef<HTMLDivElement>;

  readonly resources = signal<ResourceLibraryItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly activeCategory = signal<'All' | 'Strategies' | 'Tips' | 'Templates' | 'References'>('All');

  readonly categories: Array<'All' | 'Strategies' | 'Tips' | 'Templates' | 'References'> = [
    'All',
    'Strategies',
    'Tips',
    'Templates',
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
  readonly previewModalOpen = signal(false);
  readonly previewMode = signal<'pdf' | 'docx' | 'unsupported'>('unsupported');
  readonly previewLoading = signal(false);
  readonly previewTitle = signal('');
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewText = signal('');
  readonly previewRenderFailed = signal(false);
  readonly selectedItem = signal<ResourceLibraryItem | null>(null);
  private activeObjectUrl: string | null = null;


  editTitle = '';
  editDescription = '';
  editCategory: 'Strategies' | 'Tips' | 'Templates' | 'References' = 'References';

  uploadTitle = '';
  uploadDescription = '';
  uploadCategory: 'Strategies' | 'Tips' | 'Templates' | 'References' = 'References';
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

  setCategory(category: 'All' | 'Strategies' | 'Tips' | 'Templates' | 'References'): void {
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

  deleteResource(item: ResourceLibraryItem): void {
    const confirmed = window.confirm(`Delete resource file "${item.file_name}"? This removes it from the reference folder.`);
    if (!confirmed) {
      return;
    }

    this.saving.set(true);
    this.api.deleteReference(item.file_name).subscribe({
      next: () => {
        this.resources.update((current) => current.filter((existing) => existing.id !== item.id));
        this.saving.set(false);
        this.error.set(null);
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

  openPreview(item: ResourceLibraryItem): void {
    const fileName = item.file_name || '';
    const lower = fileName.toLowerCase();

    this.previewTitle.set(item.title || fileName);
    this.previewText.set('');
    this.previewRenderFailed.set(false);
    this.previewUrl.set(null);
    this.previewLoading.set(false);

    if (lower.endsWith('.pdf')) {
      this.previewMode.set('pdf');
      this.previewLoading.set(true);
      this.previewModalOpen.set(true);
      
      this.api.getReferenceFileBuffer(fileName).subscribe({
        next: (buffer) => {
          const blob = new Blob([buffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          this.activeObjectUrl = url;
          this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.previewLoading.set(false);
        },
        error: (error) => {
          this.error.set(this.api.describeError(error));
          this.previewLoading.set(false);
          this.previewRenderFailed.set(true);
        }
      });
      return;
    }

    if (lower.endsWith('.docx')) {
      this.previewMode.set('docx');
      this.previewModalOpen.set(true);
      this.previewLoading.set(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          void this.renderDocxPreview(fileName);
        });
      });
      return;
    }

    this.previewMode.set('unsupported');
    this.previewModalOpen.set(true);
  }

  closePreview(): void {
    this.previewModalOpen.set(false);
    this.previewLoading.set(false);
    this.previewUrl.set(null);
    this.previewText.set('');
    this.previewRenderFailed.set(false);

    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }

    const host = this.docxPreviewHost?.nativeElement;
    if (host) {
      host.innerHTML = '';
    }
  }

  ngOnDestroy(): void {
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
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

  private normalizeCategory(value: string): 'Strategies' | 'Tips' | 'Templates' | 'References' {
    if (value === 'Strategies' || value === 'Tips' || value === 'Templates' || value === 'References') {
      return value;
    }

    return 'References';
  }

  private async renderDocxPreview(fileName: string): Promise<void> {
    try {
      const host = await this.waitForDocxHost();
      if (!host) {
        this.previewRenderFailed.set(true);
        this.previewText.set('DOCX preview container was unavailable. Showing text fallback.');
        this.api.getReferencePreviewText(fileName).subscribe({
          next: (text) => {
            this.previewText.set(text || 'Unable to render this DOCX file.');
            this.previewLoading.set(false);
          },
          error: (error) => {
            this.previewText.set(this.api.describeError(error));
            this.previewLoading.set(false);
          }
        });
        return;
      }

      host.innerHTML = '';
      const buffer = await firstValueFrom(this.api.getReferenceFileBuffer(fileName));
      const docxPreview = await import('docx-preview');
      await docxPreview.renderAsync(buffer, host, host, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        useBase64URL: true
      });
      this.previewLoading.set(false);
    } catch (error) {
      this.previewRenderFailed.set(true);
      this.api.getReferencePreviewText(fileName).subscribe({
        next: (text) => {
          this.previewText.set(text || 'Unable to render this DOCX file.');
          this.previewLoading.set(false);
        },
        error: (fallbackError) => {
          this.previewText.set(this.api.describeError(fallbackError || error));
          this.previewLoading.set(false);
        }
      });
    }
  }

  private async waitForDocxHost(maxAttempts = 20): Promise<HTMLDivElement | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const host = this.docxPreviewHost?.nativeElement;
      if (host) {
        return host;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 25);
      });
    }

    return null;
  }
}