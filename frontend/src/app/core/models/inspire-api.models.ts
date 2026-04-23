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
  references?: string[];
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

export interface DifficultyCategoryRecord {
  id: number;
  name: string;
  description: string;
  observable_characteristics: string[];
  accommodation_tips: string;
  referral_note: string;
  has_subcategories: boolean;
}

export interface AdminStats {
  user_id: number;
  username: string;
  display_name: string;
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
