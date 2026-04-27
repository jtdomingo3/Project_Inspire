import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import {
  AssistantConversationDetail,
  AssistantConversationSummary,
  ChatbotQueryResponse,
  ResourceLibraryItem
} from '../../core/models/inspire-api.models';
import { InspireApiService } from '../../core/services/inspire-api.service';
import { marked } from 'marked';

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
  protected readonly initializing = signal(true);
  protected readonly availableModels = signal<string[]>([]);
  protected readonly references = signal<ResourceLibraryItem[]>([]);
  protected readonly conversations = signal<AssistantConversationSummary[]>([]);
  protected readonly activeConversationId = signal<number | null>(null);
  protected readonly selectedModel = signal('');
  protected readonly selectedReferences = signal<string[]>([]);
  protected readonly useReferences = signal(true);
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
    this.api.getLlmSettings().subscribe({
      next: (settings) => {
        const provider = settings.provider || 'openrouter';
        
        forkJoin({
          models: this.api.getLlmModels(provider),
          references: this.api.getResourceLibrary(),
          conversations: this.api.listAssistantConversations()
        }).subscribe({
          next: ({ models, references, conversations }) => {
            // Filter for free models ONLY if using OpenRouter without a personal API key
            const isManagedOpenRouter = provider === 'openrouter' && !settings.has_openrouter_api_key;
            const filteredModels = isManagedOpenRouter 
              ? models.filter((m) => m.includes(':free'))
              : models;
            
            const finalModels = filteredModels.length > 0 ? filteredModels : models;
            
            this.availableModels.set(finalModels);
            this.references.set(references);
            
            // Priority: 1. Conversation's last model, 2. Global preferred model, 3. First from list
            const defaultModel = settings.preferred_model || finalModels[0] || '';
            this.selectedModel.set(defaultModel);
            
            this.conversations.set(conversations);
            this.loadError.set('');
            this.initializing.set(false);
 
            const firstConversation = conversations[0];
            if (firstConversation?.id) {
              this.openConversation(firstConversation.id);
            } else {
              this.messages.set([
                {
                  id: 'welcome-assistant-page',
                  role: 'assistant',
                  content: 'No saved conversation yet. Click New Topic to start and it will be saved automatically.',
                  timestamp: Date.now()
                }
              ]);
            }
          },
          error: (error) => {
            this.loadError.set(this.api.describeError(error));
            this.initializing.set(false);
          }
        });
      },
      error: (error) => {
        this.loadError.set('Failed to load LLM settings: ' + this.api.describeError(error));
        this.initializing.set(false);
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
        content: 'Messages are hidden in this view. Your saved conversation remains in history.',
        timestamp: Date.now()
      }
    ]);
  }

  protected createNewConversation(): void {
    this.api.createAssistantConversation({
      title: 'New Conversation',
      model: this.selectedModel() || undefined,
      references: this.selectedReferences()
    }).subscribe({
      next: (conversation) => {
        this.conversations.update((current) => [conversation, ...current]);
        this.activeConversationId.set(conversation.id);
        this.messages.set([
          {
            id: `welcome-new-conversation-${Date.now()}`,
            role: 'assistant',
            content: 'New topic created. Ask your question and this conversation will be saved for continuation.',
            timestamp: Date.now()
          }
        ]);
      },
      error: (error) => {
        this.loadError.set(this.api.describeError(error));
      }
    });
  }

  protected openConversation(conversationId: number): void {
    this.api.getAssistantConversation(conversationId).subscribe({
      next: (conversation) => {
        this.applyConversation(conversation);
        this.loadError.set('');
      },
      error: (error) => {
        this.loadError.set(this.api.describeError(error));
      }
    });
  }

  protected deleteConversation(conversationId: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.api.deleteAssistantConversation(conversationId).subscribe({
      next: () => {
        const remaining = this.conversations().filter((item) => item.id !== conversationId);
        this.conversations.set(remaining);

        if (this.activeConversationId() === conversationId) {
          const next = remaining[0];
          if (next?.id) {
            this.openConversation(next.id);
          } else {
            this.activeConversationId.set(null);
            this.messages.set([
              {
                id: `welcome-after-delete-${Date.now()}`,
                role: 'assistant',
                content: 'No saved conversation selected. Start a new topic to continue.',
                timestamp: Date.now()
              }
            ]);
          }
        }
      },
      error: (error) => {
        this.loadError.set(this.api.describeError(error));
      }
    });
  }

  protected send(): void {
    const question = this.draftQuestion.trim();
    if (!question || this.sending()) {
      return;
    }

    const activeId = this.activeConversationId();
    if (!activeId) {
      this.api.createAssistantConversation({
        title: 'New Conversation',
        model: this.selectedModel() || undefined,
        references: this.useReferences() 
          ? (this.selectedReferences().length > 0 ? this.selectedReferences() : null) 
          : []
      }).subscribe({
        next: (conversation) => {
          this.conversations.update((current) => [conversation, ...current]);
          this.activeConversationId.set(conversation.id);
          this.sendToConversation(conversation.id, question);
        },
        error: (error) => {
          this.loadError.set(this.api.describeError(error));
        }
      });
      return;
    }

    this.sendToConversation(activeId, question);
  }

  private sendToConversation(conversationId: number, question: string): void {
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

    this.api.queryAssistantConversation(conversationId, {
      question,
      model: this.selectedModel() || undefined,
      references: this.useReferences() 
        ? (this.selectedReferences().length > 0 ? this.selectedReferences() : null) 
        : []
    }).subscribe({
      next: (result) => {
        this.messages.update((current) => [...current, this.toAssistantMessage(result)]);
        this.sending.set(false);
        this.refreshConversationList();
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

  private refreshConversationList(): void {
    this.api.listAssistantConversations().subscribe({
      next: (conversations) => {
        this.conversations.set(conversations);
      },
      error: () => {
        // Keep current list if refresh fails.
      }
    });
  }

  private applyConversation(conversation: AssistantConversationDetail): void {
    this.activeConversationId.set(conversation.id);
    this.selectedModel.set(conversation.last_model || this.selectedModel());
    this.selectedReferences.set(conversation.references || []);

    const mapped = (conversation.messages || []).map((message) => {
      const dedupedSources = Array.from(new Set((message.sources || []).map((item) => item.source)));
      return {
        id: `db-${message.id}`,
        role: message.role,
        content: message.content,
        htmlContent: message.role === 'assistant' ? this.formatAssistantMessage(message.content) : undefined,
        sources: dedupedSources,
        timestamp: Date.parse(message.created_at || '') || Date.now()
      } as AssistantMessage;
    });

    this.messages.set(mapped.length > 0 ? mapped : [
      {
        id: `welcome-empty-conversation-${Date.now()}`,
        role: 'assistant',
        content: 'This topic is ready. Continue by asking your next question.',
        timestamp: Date.now()
      }
    ]);
  }

  protected conversationSubtitle(conversation: AssistantConversationSummary): string {
    const last = (conversation.last_message || '').trim();
    if (last) {
      return last.length > 60 ? `${last.slice(0, 57)}...` : last;
    }
    return `${conversation.message_count || 0} messages`;
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
    if (!content) return '';
    return marked.parse(content, { breaks: true, gfm: true }) as string;
  }
}
