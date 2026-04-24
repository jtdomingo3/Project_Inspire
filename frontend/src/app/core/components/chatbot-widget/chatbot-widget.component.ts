import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ChatbotQueryResponse, ResourceLibraryItem } from '../../models/inspire-api.models';
import { InspireApiService } from '../../services/inspire-api.service';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  htmlContent?: string;
  sources?: string[];
  timestamp: number;
}

@Component({
  standalone: true,
  selector: 'app-chatbot-widget',
  imports: [FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrl: './chatbot-widget.component.scss'
})
export class ChatbotWidgetComponent implements OnInit {
  private readonly api = inject(InspireApiService);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly sending = signal(false);
  protected readonly loadError = signal('');
  protected readonly availableModels = signal<string[]>([]);
  protected readonly references = signal<ResourceLibraryItem[]>([]);
  protected readonly selectedModel = signal('');
  protected readonly selectedReferences = signal<string[]>([]);
  protected readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi, I am your INSPIRE assistant. Ask me about app features, workflows, inclusive teaching support, or content from your reference library.',
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

  protected toggleOpen(): void {
    this.open.update((current) => !current);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected isAssistantRoute(): boolean {
    return this.router.url.startsWith('/assistant');
  }

  protected openAssistantPage(): void {
    this.open.set(false);
    this.router.navigateByUrl('/assistant');
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

  protected send(): void {
    const question = this.draftQuestion.trim();
    if (!question || this.sending()) {
      return;
    }

    const userMessage: ChatMessage = {
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

  private toAssistantMessage(result: ChatbotQueryResponse): ChatMessage {
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

      const numericTable = this.tryRenderNumericRowsTable(lines);
      if (numericTable) {
        return numericTable;
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

  private tryRenderNumericRowsTable(lines: string[]): string {
    const normalizedLines = this.normalizeBrokenNumericLines(lines);
    const rows: Array<{ number: string; text: string }> = [];

    for (const line of normalizedLines) {
      const match = line.match(/^(\d{1,3})(?:[.)]|\s+)?\s*(.+)$/);
      if (match) {
        rows.push({ number: match[1], text: match[2].trim() });
        continue;
      }

      if (rows.length > 0) {
        rows[rows.length - 1].text = `${rows[rows.length - 1].text} ${line}`.trim();
      }
    }

    if (rows.length < 3) {
      return '';
    }

    const rowsHtml = rows
      .map((row) => `<tr><td class="message-table-num">${row.number}</td><td>${this.applyInlineFormatting(row.text)}</td></tr>`)
      .join('');

    return `<div class="message-table-wrap"><table class="message-table"><thead><tr><th>No.</th><th>Item</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  }

  private normalizeBrokenNumericLines(lines: string[]): string[] {
    const merged: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index];
      const next = lines[index + 1];
      if (/^\d+$/.test(current) && next && /^\d+\s+.+/.test(next)) {
        merged.push(`${current}${next}`);
        index += 1;
        continue;
      }
      merged.push(current);
    }
    return merged;
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
