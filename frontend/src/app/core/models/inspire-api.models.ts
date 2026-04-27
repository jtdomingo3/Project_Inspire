export interface LessonDraft {
  subject: string;
  grade: string;
  quarter: string;
  title: string;
  objectives: string;
  difficulty: string;
  indicators: string;
  supportTypes: string;
  subcategories?: string;
  customSupport: string;
  deliveryMode: string;
}

export interface BackendLessonDraft {
  subject: string;
  grade: string;
  quarter: string;
  title: string;
  objectives: string;
  difficulty: string;
  indicators: string;
  support_types: string;
  subcategories?: string;
  custom_support: string;
  delivery_mode: string;
}

export interface LessonGenerationRequest {
  lesson_data: LessonDraft;
  model: string;
  references: string[];
}

export interface LessonGenerationResponse {
  success: boolean;
  output?: string;
  error?: string;
  source?: string;
  warning?: string;
  lesson?: LessonRecord;
  parsed?: Record<string, unknown>;
}

export interface ApiListResponse {
  models?: string[];
  provider?: string;
  references?: string[];
}

export type LlmProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface LlmProviderOption {
  id: LlmProvider;
  label: string;
}

export interface UserLlmSettings {
  provider: LlmProvider;
  provider_label?: string;
  preferred_model?: string;
  has_openrouter_api_key: boolean;
  has_openai_api_key: boolean;
  has_anthropic_api_key: boolean;
  has_google_api_key: boolean;
  has_xai_api_key: boolean;
  openrouter_api_key_masked?: string;
  openai_api_key_masked?: string;
  anthropic_api_key_masked?: string;
  google_api_key_masked?: string;
  xai_api_key_masked?: string;
  using_managed_openrouter_key?: boolean;
  available_providers?: LlmProviderOption[];
  model_options?: string[];
}

export interface UpdateUserLlmSettingsPayload {
  provider?: LlmProvider;
  preferred_model?: string;
  openrouter_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  google_api_key?: string;
  xai_api_key?: string;
  clear_keys?: string[];
}

export interface ChatbotQueryRequest {
  question: string;
  model?: string;
  references?: string[] | null;
}

export interface ChatbotSourceChunk {
  source: string;
  index: number;
}

export interface ChatbotQueryResponse {
  success: boolean;
  answer?: string;
  model?: string;
  source?: string;
  warning?: string;
  selected_refs?: string[];
  selected_ref_titles?: string[];
  sources?: ChatbotSourceChunk[];
  error?: string;
}

export interface AssistantConversationMessage {
  id: number;
  conversation_id: number;
  user_id: number;
  role: 'assistant' | 'user';
  content: string;
  sources: ChatbotSourceChunk[];
  created_at: string;
}

export interface AssistantConversationSummary {
  id: number;
  user_id: number;
  title: string;
  last_model?: string;
  references: string[];
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantConversationMessage[];
}

export interface LessonRecord {
  id: number;
  subject: string;
  grade: string;
  quarter: string;
  title: string;
  objectives: string;
  difficulty: string;
  indicators: string;
  support_types: string;
  subcategories?: string;
  custom_support: string;
  delivery_mode: string;
  ai_model_used?: string;
  reference_docs_used?: string[];
  generated_output?: string;
  generated_parsed?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
  lesson_data?: LessonDraft;
}

export interface ReflectionRecord {
  id: number;
  date: string;
  subject: string;
  grade: string;
  lesson_plan_linked: string;
  strategies_used: string;
  learner_response: string;
  worked_well?: string;
  needs_improvement?: string;
  effectiveness_rating: number;
  inspire_confidence_rating: number;
  challenges: string;
  next_steps: string;
  created_at?: string;
  updated_at?: string;
}

export interface ObservationRecord {
  id: number;
  observation_date: string;
  teacher_observed: string;
  subject: string;
  focus: string;
  phase: string;
  rating: number;
  notes: string;
  created_at?: string;
}

export interface SurveyRecord {
  id: number;
  survey_type: 'pre' | 'post' | string;
  example_label?: string;
  question_responses: Record<string, number>;
  completed_at: string;
}

export interface DailySurveyScore {
  date: string;
  survey_type: 'pre' | 'post' | string;
  individual_scores: Record<string, number>[];
  aggregate_score: number;
}

export interface SurveyQuestionsResponse {
  pre: string[];
  post: string[];
}

export interface UserAccount {
  id: number;
  username: string;
  display_name: string;
  affiliated_school?: string;
  designation?: string;
  employee_id?: string;
  supervisor?: string;
  principal?: string;
  subject_area?: string;
  grade_level_handled?: string;
  years_experience?: number;
  special_education_training?: boolean;
  research_consent?: boolean;
  role: 'teacher' | 'researcher' | 'admin' | string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: UserAccount;
  token?: string;
  error?: string;
}

export interface SetupAccountPayload {
  username: string;
  password: string;
  display_name: string;
  affiliated_school?: string;
}

export interface SetupMode {
  mode: 'single-admin' | 'admin-plus-user';
}

export interface SetupStatusResponse {
  requires_setup: boolean;
  supported_modes: Array<'single-admin' | 'admin-plus-user'>;
}

export interface SetupBootstrapPayload extends SetupMode {
  admin: SetupAccountPayload;
  user?: SetupAccountPayload;
}

export interface ResourceLibraryItem {
  id: string;
  file_name: string;
  title: string;
  description: string;
  category: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderRecord {
  id: number;
  user_id: number;
  content: string;
  due_date?: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DifficultyCategoryRecord {
  id: number;
  name: string;
  description: string;
  observable_characteristics: string[];
  subcategories: string[];
  accommodation_tips: string;
  referral_note: string;
  has_subcategories: boolean;
}

export interface AdminStats {
  user_id: number;
  username: string;
  display_name: string;
  affiliated_school?: string;
  lessons_created: number;
  reflections_submitted: number;
  observations_submitted: number;
  survey_completion: string;
  average_effectiveness_rating: number;
  top_difficulties: Array<{ name: string; value: number }>;
  top_supports: Array<{ name: string; value: number }>;
  daily_survey_scores: DailySurveyScore[];
  recent_lessons: LessonRecord[];
  recent_reflections: ReflectionRecord[];
  recent_observations: ObservationRecord[];
  recent_surveys: SurveyRecord[];
}
