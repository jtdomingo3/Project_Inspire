import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  AssistantConversationDetail,
  AssistantConversationSummary,
  AdminStats,
  ApiListResponse,
  ChatbotQueryRequest,
  ChatbotQueryResponse,
  BackendLessonDraft,
  DifficultyCategoryRecord,
  LessonRecord,
  LoginResponse,
  LessonDraft,
  LessonGenerationRequest,
  LessonGenerationResponse,
  ObservationRecord,
  ReflectionRecord,
  ReminderRecord,
  ResourceLibraryItem,
  SetupBootstrapPayload,
  SetupStatusResponse,
  SurveyQuestionsResponse,
  SurveyRecord,
  UserAccount,
} from '../models/inspire-api.models';

@Injectable({
  providedIn: 'root'
})
export class InspireApiService {
  private readonly http = inject(HttpClient);
  private readonly desktopApiBase = this.getDesktopApiBase();

  private getDesktopApiBase(): string {
    const apiBase = (globalThis as { inspireDesktop?: { apiBase?: string } }).inspireDesktop?.apiBase;
    if (typeof apiBase === 'string' && apiBase.trim()) {
      return apiBase.replace(/\/$/, '');
    }

    const apiBaseFromUrl = new URL(globalThis.location.href).searchParams.get('inspireApiBase');
    return typeof apiBaseFromUrl === 'string' ? apiBaseFromUrl.replace(/\/$/, '') : '';
  }

  getModels(): Observable<string[]> {
    return this.http.get<ApiListResponse>('/api/models').pipe(
      map((response) => response.models ?? [])
    );
  }

  queryChatbot(payload: ChatbotQueryRequest): Observable<ChatbotQueryResponse> {
    return this.http.post<ChatbotQueryResponse>('/api/chatbot/query', payload);
  }

  listAssistantConversations(): Observable<AssistantConversationSummary[]> {
    return this.http.get<{ success?: boolean; conversations?: AssistantConversationSummary[] }>('/api/assistant/conversations').pipe(
      map((response) => response.conversations ?? [])
    );
  }

  createAssistantConversation(payload: { title?: string; model?: string; references?: string[] }): Observable<AssistantConversationSummary> {
    return this.http.post<{ success?: boolean; conversation: AssistantConversationSummary }>('/api/assistant/conversations', payload).pipe(
      map((response) => response.conversation)
    );
  }

  getAssistantConversation(id: number): Observable<AssistantConversationDetail> {
    return this.http.get<{ success?: boolean; conversation: AssistantConversationDetail }>(`/api/assistant/conversations/${id}`).pipe(
      map((response) => response.conversation)
    );
  }

  deleteAssistantConversation(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/assistant/conversations/${id}`);
  }

  queryAssistantConversation(id: number, payload: ChatbotQueryRequest): Observable<ChatbotQueryResponse> {
    return this.http.post<ChatbotQueryResponse>(`/api/assistant/conversations/${id}/query`, payload);
  }

  getReferences(): Observable<string[]> {
    return this.http.get<ApiListResponse>('/api/references').pipe(
      map((response) => response.references ?? [])
    );
  }

  getResourceLibrary(): Observable<ResourceLibraryItem[]> {
    return this.http.get<{ items?: ResourceLibraryItem[] }>('/api/resource-library').pipe(
      map((response) => response.items ?? [])
    );
  }

  getReferenceFileUrl(fileName: string): string {
    return `${this.desktopApiBase}/api/resource-library/file/${encodeURIComponent(fileName)}`;
  }

  getReferenceFileBuffer(fileName: string): Observable<ArrayBuffer> {
    return this.http.get(`/api/resource-library/file/${encodeURIComponent(fileName)}`, {
      responseType: 'arraybuffer'
    });
  }

  getReferencePreviewText(fileName: string): Observable<string> {
    return this.http.get<{ success?: boolean; text?: string }>(`/api/resource-library/preview-text/${encodeURIComponent(fileName)}`).pipe(
      map((response) => response.text ?? '')
    );
  }

  updateResourceLibraryItem(fileName: string, payload: { title: string; description: string; category?: string }): Observable<{ success: boolean; item: ResourceLibraryItem }> {
    return this.http.put<{ success: boolean; item: ResourceLibraryItem }>(`/api/resource-library/${encodeURIComponent(fileName)}`, payload);
  }

  uploadReference(payload: { fileName: string; contentBase64: string; title?: string; description?: string; category?: string; overwrite?: boolean }): Observable<{ success: boolean; item: ResourceLibraryItem }> {
    return this.http.post<{ success: boolean; item: ResourceLibraryItem }>('/api/resource-library/upload', payload);
  }

  deleteReference(fileName: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/resource-library/${encodeURIComponent(fileName)}`);
  }

  getDifficultyCategories(): Observable<DifficultyCategoryRecord[]> {
    return this.http.get<{ categories?: DifficultyCategoryRecord[] }>('/api/difficulty-categories').pipe(
      map((response) => response.categories ?? [])
    );
  }

  saveDifficultyCategory(payload: Partial<DifficultyCategoryRecord> & { name: string }): Observable<{ success: boolean; category: DifficultyCategoryRecord }> {
    if (payload.id) {
      return this.http.put<{ success: boolean; category: DifficultyCategoryRecord }>(`/api/difficulty-categories/${payload.id}`, payload);
    }
    return this.http.post<{ success: boolean; category: DifficultyCategoryRecord }>('/api/difficulty-categories', payload);
  }

  deleteDifficultyCategory(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/difficulty-categories/${id}`);
  }

  getLessons(): Observable<LessonRecord[]> {
    return this.http.get<{ lessons?: LessonRecord[] }>('/api/lessons').pipe(
      map((response) => response.lessons ?? [])
    );
  }

  getLesson(id: number): Observable<LessonRecord> {
    return this.http.get<{ lesson: LessonRecord }>(`/api/lessons/${id}`).pipe(
      map((response) => response.lesson)
    );
  }

  updateLesson(id: number, lesson: Partial<LessonRecord> & { lesson_data?: LessonDraft; model?: string; references?: string[] }): Observable<{ success: boolean; lesson: LessonRecord }> {
    return this.http.put<{ success: boolean; lesson: LessonRecord }>(`/api/lessons/${id}`, lesson);
  }

  deleteLesson(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/lessons/${id}`);
  }

  saveLesson(lesson: Partial<LessonRecord> & { lesson_data?: LessonDraft; model?: string; references?: string[] }): Observable<{ success: boolean; lesson: LessonRecord }> {
    return this.http.post<{ success: boolean; lesson: LessonRecord }>('/api/lessons', lesson);
  }

  generateLessonPlan(request: LessonGenerationRequest): Observable<LessonGenerationResponse> {
    return this.http.post<LessonGenerationResponse>('/api/generate', {
      ...request,
      lesson_data: this.toBackendLessonDraft(request.lesson_data)
    });
  }

  toBackendLessonDraft(lessonDraft: LessonDraft): BackendLessonDraft {
    return {
      subject: lessonDraft.subject,
      grade: lessonDraft.grade,
      quarter: lessonDraft.quarter,
      title: lessonDraft.title,
      objectives: lessonDraft.objectives,
      difficulty: lessonDraft.difficulty,
      indicators: lessonDraft.indicators,
      support_types: lessonDraft.supportTypes,
      subcategories: lessonDraft.subcategories,
      custom_support: lessonDraft.customSupport,
      delivery_mode: lessonDraft.deliveryMode
    };
  }

  describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const rawBody = typeof error.error === 'string' ? error.error : '';
      const htmlLikeBody = rawBody.trim().toLowerCase().startsWith('<!doctype') || rawBody.trim().startsWith('<html');

      if (error.error instanceof SyntaxError || htmlLikeBody) {
        return `API response was HTML instead of JSON at ${error.url || 'unknown endpoint'}. Verify backend is running and API routing is configured.`;
      }

      const backendError = (error.error && typeof error.error === 'object' && 'error' in error.error)
        ? String((error.error as { error?: unknown }).error || '')
        : '';

      return backendError || `HTTP ${error.status || 0} ${error.statusText || 'Request failed'} at ${error.url || 'unknown endpoint'}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null) {
      const anyError = error as { error?: { error?: string }; message?: string; statusText?: string };
      return anyError.error?.error ?? anyError.message ?? anyError.statusText ?? 'Unknown API error';
    }

    return 'Unknown API error';
  }

  formatOutput(output: string | undefined): string {
    if (!output) {
      return '';
    }

    try {
      return JSON.stringify(JSON.parse(output), null, 2);
    } catch {
      return output;
    }
  }

  createLessonDraft(): LessonDraft {
    return {
      subject: 'Mathematics',
      grade: 'Grade 5',
      quarter: 'Quarter 1',
      title: 'Fractions Activity',
      objectives: 'Use concrete and visual models to compare simple fractions.',
      difficulty: 'Reading comprehension',
      indicators: 'Needs chunked directions, needs visual supports',
      supportTypes: 'Visual aids, guided practice, peer support',
      subcategories: '',
      customSupport: 'Allow oral responses and provide worked examples.',
      deliveryMode: 'Whole class with small-group support'
    };
  }

  getReflections(): Observable<ReflectionRecord[]> {
    return this.http.get<{ reflections?: ReflectionRecord[] }>('/api/reflections').pipe(
      map((response) => response.reflections ?? [])
    );
  }

  saveReflection(payload: Omit<ReflectionRecord, 'id' | 'created_at' | 'updated_at'>): Observable<{ success: boolean; reflection: ReflectionRecord }> {
    return this.http.post<{ success: boolean; reflection: ReflectionRecord }>('/api/reflections', payload);
  }

  updateReflection(id: number, payload: Omit<ReflectionRecord, 'id' | 'created_at' | 'updated_at'>): Observable<{ success: boolean; reflection: ReflectionRecord }> {
    return this.http.put<{ success: boolean; reflection: ReflectionRecord }>(`/api/reflections/${id}`, payload);
  }

  deleteReflection(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/reflections/${id}`);
  }

  getObservations(): Observable<ObservationRecord[]> {
    return this.http.get<{ observations?: ObservationRecord[] }>('/api/observations').pipe(
      map((response) => response.observations ?? [])
    );
  }

  saveObservation(payload: Omit<ObservationRecord, 'id' | 'created_at'>): Observable<{ success: boolean; observation: ObservationRecord }> {
    return this.http.post<{ success: boolean; observation: ObservationRecord }>('/api/observations', payload);
  }

  updateObservation(id: number, payload: Omit<ObservationRecord, 'id' | 'created_at'>): Observable<{ success: boolean; observation: ObservationRecord }> {
    return this.http.put<{ success: boolean; observation: ObservationRecord }>(`/api/observations/${id}`, payload);
  }

  deleteObservation(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/observations/${id}`);
  }

  getSurveyQuestions(): Observable<SurveyQuestionsResponse> {
    return this.http.get<SurveyQuestionsResponse>('/api/surveys/questions');
  }

  getSurveys(): Observable<SurveyRecord[]> {
    return this.http.get<{ surveys?: SurveyRecord[] }>('/api/surveys').pipe(
      map((response) => response.surveys ?? [])
    );
  }

  saveSurvey(payload: { survey_type: 'pre' | 'post'; question_responses: Record<string, number>; completed_at?: string }): Observable<{ success: boolean; survey: SurveyRecord }> {
    return this.http.post<{ success: boolean; survey: SurveyRecord }>('/api/surveys', payload);
  }

  deleteSurvey(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/surveys/${id}`);
  }

  getReminders(): Observable<ReminderRecord[]> {
    return this.http.get<{ reminders?: ReminderRecord[] }>('/api/reminders').pipe(
      map((response) => response.reminders ?? [])
    );
  }

  saveReminder(payload: { content: string; due_date?: string }): Observable<{ success: boolean; reminder: ReminderRecord }> {
    return this.http.post<{ success: boolean; reminder: ReminderRecord }>('/api/reminders', payload);
  }

  updateReminder(id: number, payload: { content?: string; due_date?: string; is_completed?: boolean }): Observable<{ success: boolean; reminder: ReminderRecord }> {
    return this.http.put<{ success: boolean; reminder: ReminderRecord }>(`/api/reminders/${id}`, payload);
  }

  deleteReminder(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/reminders/${id}`);
  }

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>('/api/admin/stats');
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { username, password });
  }

  refreshToken(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/refresh', {});
  }

  getSetupStatus(): Observable<SetupStatusResponse> {
    return this.http.get<SetupStatusResponse>('/api/setup/status');
  }

  bootstrapSetup(payload: SetupBootstrapPayload): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/setup/bootstrap', payload);
  }

  listAccounts(): Observable<UserAccount[]> {
    return this.http.get<{ users?: UserAccount[] }>('/api/admin/accounts').pipe(
      map((response) => response.users ?? [])
    );
  }

  saveAccount(payload: Partial<UserAccount> & { username: string; role: string; display_name: string; affiliated_school?: string; password?: string; active?: boolean; id?: number }): Observable<{ success: boolean; user: UserAccount }> {
    if (payload.id) {
      return this.http.put<{ success: boolean; user: UserAccount }>(`/api/admin/accounts/${payload.id}`, payload);
    }

    return this.http.post<{ success: boolean; user: UserAccount }>('/api/admin/accounts', payload);
  }

  deleteAccount(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/admin/accounts/${id}`);
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'researcher':
        return 'Researcher';
      case 'teacher':
      default:
        return 'Teacher';
    }
  }

  canAccessAdmin(role: string): boolean {
    return role === 'admin' || role === 'researcher';
  }

  canManageAccounts(role: string): boolean {
    return role === 'admin';
  }

  getProfile(): Observable<UserAccount> {
    return this.http.get<{ success: boolean; user: UserAccount }>('/api/profile').pipe(
      map(response => response.user)
    );
  }

  updateProfile(payload: Partial<UserAccount>): Observable<{ success: boolean; user: UserAccount }> {
    return this.http.put<{ success: boolean; user: UserAccount }>('/api/profile', payload);
  }

  changePassword(current_password: string, new_password: string): Observable<{ success: boolean; error?: string }> {
    return this.http.put<{ success: boolean; error?: string }>('/api/profile/password', { current_password, new_password });
  }
}
