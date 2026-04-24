function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function optionalString(value) {
  return String(value ?? '').trim();
}

function requireIntegerInRange(value, fieldName, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function requireEnum(value, fieldName, allowed) {
  const normalized = String(value ?? '').trim();
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
}

function toStringArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

export function validateLoginPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('Request body must be an object');
  }
  return {
    username: requireString(payload.username ?? payload.email, 'username'),
    password: requireString(payload.password, 'password')
  };
}

export function validateLessonPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('lesson payload must be an object');
  }

  return {
    ...payload,
    subject: requireString(payload.subject, 'subject'),
    grade: requireString(payload.grade, 'grade'),
    quarter: requireString(payload.quarter, 'quarter'),
    title: requireString(payload.title, 'title'),
    objectives: requireString(payload.objectives, 'objectives'),
    difficulty: requireString(payload.difficulty, 'difficulty'),
    indicators: requireString(payload.indicators, 'indicators'),
    support_types: requireString(payload.support_types, 'support_types'),
    delivery_mode: requireString(payload.delivery_mode, 'delivery_mode'),
    status: requireEnum(payload.status ?? 'draft', 'status', ['draft', 'final', 'example']),
    reference_docs_used: toStringArray(payload.reference_docs_used ?? [])
  };
}

export function validateReflectionPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('reflection payload must be an object');
  }

  return {
    ...payload,
    date: requireString(payload.date, 'date'),
    subject: requireString(payload.subject, 'subject'),
    grade: requireString(payload.grade, 'grade'),
    lesson_plan_linked: requireString(payload.lesson_plan_linked, 'lesson_plan_linked'),
    strategies_used: requireString(payload.strategies_used, 'strategies_used'),
    learner_response: requireString(payload.learner_response, 'learner_response'),
    worked_well: requireString(payload.worked_well, 'worked_well'),
    needs_improvement: requireString(payload.needs_improvement, 'needs_improvement'),
    effectiveness_rating: requireIntegerInRange(payload.effectiveness_rating, 'effectiveness_rating', 1, 5),
    inspire_confidence_rating: requireIntegerInRange(payload.inspire_confidence_rating, 'inspire_confidence_rating', 1, 5),
    challenges: requireString(payload.challenges, 'challenges'),
    next_steps: requireString(payload.next_steps, 'next_steps')
  };
}

export function validateObservationPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('observation payload must be an object');
  }

  return {
    ...payload,
    observation_date: requireString(payload.observation_date, 'observation_date'),
    teacher_observed: requireString(payload.teacher_observed, 'teacher_observed'),
    subject: requireString(payload.subject, 'subject'),
    focus: requireString(payload.focus, 'focus'),
    phase: requireString(payload.phase, 'phase'),
    rating: requireIntegerInRange(payload.rating, 'rating', 1, 5),
    notes: requireString(payload.notes, 'notes')
  };
}

export function validateSurveyPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('survey payload must be an object');
  }
  const surveyType = requireEnum(payload.survey_type, 'survey_type', ['pre', 'post']);
  const responses = isObject(payload.question_responses) ? payload.question_responses : null;
  if (!responses) {
    throw new Error('question_responses must be an object');
  }

  const normalizedResponses = {};
  for (const [key, value] of Object.entries(responses)) {
    normalizedResponses[String(key)] = requireIntegerInRange(value, `question_responses.${key}`, 1, 5);
  }
  if (Object.keys(normalizedResponses).length === 0) {
    throw new Error('question_responses must have at least one answer');
  }

  return {
    ...payload,
    survey_type: surveyType,
    question_responses: normalizedResponses
  };
}

export function validateUserPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('user payload must be an object');
  }

  return {
    ...payload,
    username: requireString(payload.username, 'username').toLowerCase(),
    password: requireString(payload.password, 'password'),
    display_name: requireString(payload.display_name, 'display_name'),
    role: requireEnum(payload.role, 'role', ['teacher', 'researcher', 'admin']),
    affiliated_school: optionalString(payload.affiliated_school),
    active: payload.active !== false
  };
}

export function validateResourceMetadataPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('resource payload must be an object');
  }

  return {
    ...payload,
    title: requireString(payload.title, 'title'),
    description: requireString(payload.description, 'description'),
    category: requireEnum(payload.category ?? 'References', 'category', ['Strategies', 'Tips', 'Templates', 'References'])
  };
}

export function validateDifficultyCategoryPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('difficulty category payload must be an object');
  }

  const observable = toStringArray(payload.observable_characteristics);
  const subcategories = toStringArray(payload.subcategories);
  return {
    id: payload.id ? Number(payload.id) : undefined,
    name: requireString(payload.name, 'name'),
    description: optionalString(payload.description),
    observable_characteristics: observable,
    subcategories: subcategories,
    accommodation_tips: optionalString(payload.accommodation_tips),
    referral_note: optionalString(payload.referral_note),
    has_subcategories: payload.has_subcategories === true
  };
}

export function validateReminderPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('reminder payload must be an object');
  }

  return {
    ...payload,
    content: requireString(payload.content, 'content'),
    due_date: optionalString(payload.due_date ?? payload.dueDate),
    is_completed: payload.is_completed === true || payload.isCompleted === true
  };
}
