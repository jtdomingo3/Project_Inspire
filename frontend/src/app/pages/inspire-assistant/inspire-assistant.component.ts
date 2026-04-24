import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ChatbotQueryResponse, ResourceLibraryItem } from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';

interface AssistantMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  htmlContent?: string;
  sources?: string[];
  timestamp: number;
}

@Component({
  standalone: true,
  selector: 'app-inspire-assistant',
  imports: [FormsModule],
  templateUrl: './inspire-assistant.component.html',
  styleUrl: './inspire-assistant.component.scss'
})
export class InspireAssistantComponent implements OnInit {
  private readonly api = inject(InspireApiService);

  protected readonly sending = signal(false);
  protected readonly loadError = signal('');
  protected readonly availableModels = signal<string[]>([]);
  protected readonly references = signal<ResourceLibraryItem[]>([]);
  protected readonly selectedModel = signal('');
  protected readonly selectedReferences = signal<string[]>([]);
  protected readonly messages = signal<AssistantMessage[]>([
    {
      id: 'welcome-assistant-page',
      role: 'assistant',
      content: 'Welcome to the Inspire Assistant page. Ask about app workflows, references, or inclusive teaching support.',
      timestamp: Date.now()
    }
  ]);

  protected draftQuestion = '';

  ngOnInit(): void {
    forkJoin({
      models: this.api.getModels(),
      references: this.api.getResourceLibrary()
    }).subscribe({
      next: ({ models, references }) => {
        const freeModels = models.filter((model) => model.includes(':free'));
        const finalModels = freeModels.length > 0 ? freeModels : models;
        this.availableModels.set(finalModels);
        this.references.set(references);
        this.selectedModel.set(finalModels[0] || '');
        this.loadError.set('');
      },
      error: (error) => {
        this.loadError.set(this.api.describeError(error));
      }
    });
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected onReferenceToggle(fileName: string, checked: boolean): void {
    this.selectedReferences.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(fileName);
      } else {
        next.delete(fileName);
      }
      return Array.from(next);
    });
  }

  protected clearChat(): void {
    this.messages.set([
      {
        id: `welcome-assistant-page-${Date.now()}`,
        role: 'assistant',
        content: 'Chat cleared. Ask a new question when ready.',
        timestamp: Date.now()
      }
    ]);
  }

  protected send(): void {
    const question = this.draftQuestion.trim();
    if (!question || this.sending()) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now()
    };

    this.messages.update((current) => [...current, userMessage]);
    this.draftQuestion = '';
    this.sending.set(true);
    this.loadError.set('');

    this.api.queryChatbot({
      question,
      model: this.selectedModel() || undefined,
      references: this.selectedReferences()
    }).subscribe({
      next: (result) => {
        this.messages.update((current) => [...current, this.toAssistantMessage(result)]);
        this.sending.set(false);
      },
      error: (error) => {
        this.sending.set(false);
        const message = this.api.describeError(error);
        this.loadError.set(message);
        this.messages.update((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: `I could not process your request right now. ${message}`,
            timestamp: Date.now()
          }
        ]);
      }
    });
  }

  protected sourceLabel(source: string): string {
    const match = this.references().find((item) => item.file_name === source);
    return match?.title || source;
  }

  private toAssistantMessage(result: ChatbotQueryResponse): AssistantMessage {
    const dedupedSources = Array.from(new Set((result.sources || []).map((item) => item.source)));
    const content = result.answer || result.error || 'No answer was returned by the chatbot service.';
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content,
      htmlContent: this.formatAssistantMessage(content),
      sources: dedupedSources,
      timestamp: Date.now()
    };
  }

  private formatAssistantMessage(content: string): string {
    const safe = this.escapeHtml(content).replace(/\r\n/g, '\n');
    const paragraphs = safe.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean);

    const rendered = paragraphs.map((paragraph) => {
      const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        return '';
      }

      const table = this.tryRenderMarkdownTable(lines);
      if (table) {
        return table;
      }

      const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));
      const numberedLines = lines.filter((line) => /^\d+[.)]\s+/.test(line));

      if (bulletLines.length === lines.length) {
        const items = lines
          .map((line) => line.replace(/^[-*•]\s+/, ''))
          .map((line) => `<li>${this.applyInlineFormatting(line)}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      if (numberedLines.length === lines.length) {
        const items = lines
          .map((line) => line.replace(/^\d+[.)]\s+/, ''))
          .map((line) => `<li>${this.applyInlineFormatting(line)}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      return `<p>${this.applyInlineFormatting(lines.join('<br>'))}</p>`;
    });

    return rendered.join('');
  }

  private tryRenderMarkdownTable(lines: string[]): string {
    if (lines.length < 3 || !lines.every((line) => line.includes('|'))) {
      return '';
    }

    const headerCells = this.parseTableRow(lines[0]);
    const separatorCells = this.parseTableRow(lines[1]).map((cell) => cell.replace(/\s+/g, ''));
    if (!headerCells.length || headerCells.length !== separatorCells.length) {
      return '';
    }

    if (!separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      return '';
    }

    const bodyRows = lines
      .slice(2)
      .map((line) => this.parseTableRow(line))
      .filter((row) => row.length > 0);

    if (!bodyRows.length) {
      return '';
    }

    const headerHtml = headerCells
      .map((cell) => `<th>${this.applyInlineFormatting(cell)}</th>`)
      .join('');

    const rowsHtml = bodyRows
      .map((row) => {
        const normalized = this.normalizeRowLength(row, headerCells.length);
        const cells = normalized
          .map((cell) => `<td>${this.applyInlineFormatting(cell)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<div class="message-table-wrap"><table class="message-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  }

  private parseTableRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    if (!trimmed) {
      return [];
    }
    return trimmed.split('|').map((cell) => cell.trim());
  }

  private normalizeRowLength(row: string[], targetLength: number): string[] {
    if (row.length === targetLength) {
      return row;
    }

    const result = row.slice(0, targetLength);
    while (result.length < targetLength) {
      result.push('');
    }
    return result;
  }

  private applyInlineFormatting(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
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
