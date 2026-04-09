import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';

import { projectRoot, referencesDir, supportedModels, surveyQuestions } from './config.js';
import { generateLessonPlan } from './openrouter.js';
import {
  deleteReferenceMetadata,
  deleteUser,
  findUserByCredentials,
  getDefaultStoreSnapshot,
  getReferenceLibraryItems,
  listUsers,
  getReferenceNames,
  normalizeArray,
  normalizeText,
  nextNumericId,
  readStore,
  upsertReferenceMetadata,
  upsertUser,
  upsertLesson,
  upsertObservation,
  upsertReflection,
  upsertSurvey,
  writeStore
} from './store.js';

dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use((request, response, next) => {
  const start = Date.now();
  response.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`${request.method} ${request.originalUrl} -> ${response.statusCode} (${durationMs}ms)`);
  });
  next();
});

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function ensureObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value;
}

function normalizeLessonPayload(body) {
  const payload = ensureObject(body, 'Request body');
  const lessonData = ensureObject(payload.lesson_data ?? payload.lessonData ?? payload, 'lesson_data');

  return {
    subject: normalizeText(lessonData.subject),
    grade: normalizeText(lessonData.grade),
    quarter: normalizeText(lessonData.quarter),
    title: normalizeText(lessonData.title, 'Untitled Lesson'),
    objectives: normalizeText(lessonData.objectives),
    difficulty: normalizeText(lessonData.difficulty),
    indicators: normalizeText(lessonData.indicators),
    support_types: normalizeText(lessonData.support_types ?? lessonData.supportTypes),
    custom_support: normalizeText(lessonData.custom_support ?? lessonData.customSupport),
    delivery_mode: normalizeText(lessonData.delivery_mode ?? lessonData.deliveryMode),
    ai_model_used: normalizeText(payload.model),
    reference_docs_used: normalizeArray(payload.references ?? payload.selected_refs),
    generated_output: normalizeText(payload.generated_output),
    status: normalizeText(payload.status, 'draft'),
    lesson_data: lessonData
  };
}

function normalizeReflectionPayload(body) {
  const payload = ensureObject(body, 'Request body');
  return {
    id: payload.id,
    date: normalizeText(payload.date ?? payload.reflection_date),
    subject: normalizeText(payload.subject),
    grade: normalizeText(payload.grade),
    lesson_plan_linked: normalizeText(payload.lesson_plan_linked ?? payload.lessonPlanLinked),
    strategies_used: normalizeText(payload.strategies_used ?? payload.strategiesUsed),
    learner_response: normalizeText(payload.learner_response ?? payload.learnerResponse),
    worked_well: normalizeText(payload.worked_well ?? payload.workedWell),
    needs_improvement: normalizeText(payload.needs_improvement ?? payload.needsImprovement),
    effectiveness_rating: Number(payload.effectiveness_rating ?? payload.effectivenessRating ?? 0),
    inspire_confidence_rating: Number(payload.inspire_confidence_rating ?? payload.inspireConfidenceRating ?? 0),
    challenges: normalizeText(payload.challenges),
    next_steps: normalizeText(payload.next_steps ?? payload.nextSteps)
  };
}

function normalizeObservationPayload(body) {
  const payload = ensureObject(body, 'Request body');
  return {
    observation_date: normalizeText(payload.observation_date ?? payload.date),
    teacher_observed: normalizeText(payload.teacher_observed ?? payload.teacherObserved),
    subject: normalizeText(payload.subject),
    focus: normalizeText(payload.focus),
    phase: normalizeText(payload.phase),
    rating: Number(payload.rating ?? 0),
    notes: normalizeText(payload.notes)
  };
}

function normalizeSurveyPayload(body) {
  const payload = ensureObject(body, 'Request body');
  return {
    survey_type: normalizeText(payload.survey_type ?? payload.surveyType),
    question_responses: payload.question_responses ?? payload.questionResponses ?? {},
    completed_at: payload.completed_at ?? payload.completedAt
  };
}

function sanitizeUser(user) {
  return {
    id: Number(user.id),
    username: normalizeText(user.username).toLowerCase(),
    display_name: normalizeText(user.display_name),
    role: normalizeText(user.role).toLowerCase(),
    active: user.active !== false,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

function normalizeUserPayload(body) {
  const payload = ensureObject(body, 'Request body');
  const role = normalizeText(payload.role).toLowerCase();
  if (!['teacher', 'researcher', 'admin'].includes(role)) {
    throw new Error('role must be one of: teacher, researcher, admin');
  }

  return {
    id: payload.id,
    username: normalizeText(payload.username).toLowerCase(),
    password: normalizeText(payload.password, 'password123'),
    display_name: normalizeText(payload.display_name ?? payload.displayName, 'Unnamed User'),
    role,
    active: payload.active !== false
  };
}

function normalizeResourcePayload(body) {
  const payload = ensureObject(body, 'Request body');
  return {
    title: normalizeText(payload.title),
    description: normalizeText(payload.description),
    category: normalizeText(payload.category, 'References')
  };
}

function sanitizeReferenceFileName(fileName) {
  const normalized = normalizeText(fileName).replace(/[\\/]/g, '');
  if (!normalized) {
    throw new Error('fileName is required');
  }

  if (!/\.(pdf|docx)$/i.test(normalized)) {
    throw new Error('Only PDF and DOCX files are supported');
  }

  return normalized;
}

function aggregateStats(store) {
  const lessonCount = store.lessons.length;
  const reflectionCount = store.reflections.length;
  const observationCount = store.observations.length;
  const surveyCount = store.surveys.length;
  const completedPostSurveys = store.surveys.filter((survey) => survey.survey_type === 'post').length;
  const averageEffectiveness = store.reflections.length
    ? (store.reflections.reduce((total, reflection) => total + Number(reflection.effectiveness_rating || 0), 0) / store.reflections.length)
    : 0;

  const difficultyCounts = new Map();
  const supportCounts = new Map();

  for (const lesson of store.lessons) {
    const difficulty = normalizeText(lesson.difficulty, 'Unspecified');
    difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1);

    const supportTypes = normalizeArray(lesson.support_types || lesson.support_types_text || lesson.supportTypes);
    for (const support of supportTypes) {
      supportCounts.set(support, (supportCounts.get(support) || 0) + 1);
    }
  }

  const topDifficulties = Array.from(difficultyCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  const topSupports = Array.from(supportCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  return {
    total_teachers: 54,
    active_users_this_month: 38,
    lesson_plans_generated: lessonCount,
    reflections_submitted: reflectionCount,
    observations_submitted: observationCount,
    survey_completion: `${store.surveys.filter((survey) => survey.survey_type === 'pre').length} Pre · ${completedPostSurveys} Post`,
    average_effectiveness_rating: Number(averageEffectiveness.toFixed(1)),
    top_difficulties: topDifficulties,
    top_supports: topSupports,
    recent_lessons: store.lessons.slice(0, 5),
    recent_reflections: store.reflections.slice(0, 5),
    recent_observations: store.observations.slice(0, 5),
    recent_surveys: store.surveys.slice(0, 5)
  };
}

app.get('/api/health', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, {
    ok: true,
    models: supportedModels.length,
    lessons: store.lessons.length,
    reflections: store.reflections.length,
    observations: store.observations.length,
    surveys: store.surveys.length
  });
});

app.get('/api/models', async (_request, response) => {
  sendJson(response, 200, { models: supportedModels });
});

app.post('/api/auth/login', async (request, response) => {
  try {
    const payload = ensureObject(request.body, 'Request body');
    const username = normalizeText(payload.username ?? payload.email).toLowerCase();
    const password = normalizeText(payload.password);
    if (!username || !password) {
      sendJson(response, 400, { success: false, error: 'username and password are required' });
      return;
    }

    const user = await findUserByCredentials(username, password);
    if (!user) {
      sendJson(response, 401, { success: false, error: 'Invalid credentials' });
      return;
    }

    sendJson(response, 200, {
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/references', async (_request, response) => {
  const references = await getReferenceNames();
  sendJson(response, 200, { references });
});

app.get('/api/resource-library', async (_request, response) => {
  const items = await getReferenceLibraryItems();
  sendJson(response, 200, { items });
});

app.put('/api/resource-library/:fileName', async (request, response) => {
  try {
    const fileName = sanitizeReferenceFileName(decodeURIComponent(request.params.fileName));
    const updated = await upsertReferenceMetadata(fileName, normalizeResourcePayload(request.body));
    sendJson(response, 200, { success: true, item: updated });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.post('/api/resource-library/upload', async (request, response) => {
  try {
    const payload = ensureObject(request.body, 'Request body');
    const fileName = sanitizeReferenceFileName(payload.fileName);
    const targetPath = path.join(referencesDir, fileName);
    await fs.mkdir(referencesDir, { recursive: true });

    const hasExistingFile = await fs.access(targetPath).then(() => true).catch(() => false);
    if (hasExistingFile && payload.overwrite !== true) {
      sendJson(response, 409, { success: false, error: 'A file with this name already exists. Use overwrite=true to replace it.' });
      return;
    }

    const contentBase64 = normalizeText(payload.contentBase64);
    if (!contentBase64) {
      throw new Error('contentBase64 is required');
    }

    const stripped = contentBase64.includes(',') ? contentBase64.split(',').pop() || '' : contentBase64;
    const buffer = Buffer.from(stripped, 'base64');
    if (!buffer.length) {
      throw new Error('Invalid file content');
    }

    await fs.writeFile(targetPath, buffer);

    const item = await upsertReferenceMetadata(fileName, {
      ...normalizeResourcePayload(payload),
      title: normalizeText(payload.title, fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    });

    sendJson(response, 201, { success: true, item });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/resource-library/:fileName', async (request, response) => {
  try {
    const fileName = sanitizeReferenceFileName(decodeURIComponent(request.params.fileName));
    const targetPath = path.join(referencesDir, fileName);

    const hasExistingFile = await fs.access(targetPath).then(() => true).catch(() => false);
    if (!hasExistingFile) {
      sendJson(response, 404, { success: false, error: 'Reference file not found.' });
      return;
    }

    await fs.unlink(targetPath);
    await deleteReferenceMetadata(fileName);
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/lessons', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, { lessons: store.lessons });
});

app.get('/api/lessons/:id', async (request, response) => {
  const store = await readStore();
  const lesson = store.lessons.find((item) => Number(item.id) === Number(request.params.id));
  if (!lesson) {
    sendJson(response, 404, { error: 'Lesson not found' });
    return;
  }
  sendJson(response, 200, { lesson });
});

app.post('/api/lessons', async (request, response) => {
  try {
    const lesson = await upsertLesson(normalizeLessonPayload(request.body));
    sendJson(response, 201, { success: true, lesson });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/lessons/:id', async (request, response) => {
  try {
    const lesson = await upsertLesson({ id: Number(request.params.id), ...normalizeLessonPayload(request.body) });
    sendJson(response, 200, { success: true, lesson });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.post('/api/generate', async (request, response) => {
  try {
    const payload = ensureObject(request.body, 'Request body');
    const lessonData = ensureObject(payload.lesson_data ?? payload.lessonData, 'lesson_data');
    const references = normalizeArray(payload.references ?? payload.selected_refs);
    const model = normalizeText(payload.model);

    const generation = await generateLessonPlan(lessonData, { model, selectedRefs: references });
    const lesson = await upsertLesson({
      ...normalizeLessonPayload(request.body),
      title: normalizeText(lessonData.title, 'Untitled Lesson'),
      generated_output: generation.output,
      status: 'final',
      ai_model_used: generation.model,
      reference_docs_used: generation.selected_refs,
      lesson_data: lessonData
    });

    sendJson(response, 200, {
      success: true,
      source: generation.source,
      warning: generation.warning,
      output: generation.output,
      parsed: generation.parsed,
      lesson
    });
  } catch (error) {
    sendJson(response, 500, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/reflections', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, { reflections: store.reflections });
});

app.post('/api/reflections', async (request, response) => {
  try {
    const body = normalizeReflectionPayload(request.body);
    const record = await upsertReflection(body);
    sendJson(response, 201, { success: true, reflection: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/observations', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, { observations: store.observations });
});

app.post('/api/observations', async (request, response) => {
  try {
    const body = normalizeObservationPayload(request.body);
    const record = await upsertObservation(body);
    sendJson(response, 201, { success: true, observation: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/surveys/questions', async (_request, response) => {
  sendJson(response, 200, surveyQuestions);
});

app.get('/api/surveys', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, { surveys: store.surveys });
});

app.post('/api/surveys', async (request, response) => {
  try {
    const body = normalizeSurveyPayload(request.body);
    const record = await upsertSurvey(body);
    sendJson(response, 201, { success: true, survey: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/admin/stats', async (_request, response) => {
  const store = await readStore();
  sendJson(response, 200, aggregateStats(store));
});

app.get('/api/admin/accounts', async (_request, response) => {
  const users = await listUsers();
  sendJson(response, 200, { users: users.map(sanitizeUser) });
});

app.post('/api/admin/accounts', async (request, response) => {
  try {
    const user = await upsertUser(normalizeUserPayload(request.body));
    sendJson(response, 201, { success: true, user: sanitizeUser(user) });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/admin/accounts/:id', async (request, response) => {
  try {
    const user = await upsertUser({
      ...normalizeUserPayload(request.body),
      id: Number(request.params.id)
    });
    sendJson(response, 200, { success: true, user: sanitizeUser(user) });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/admin/accounts/:id', async (request, response) => {
  const deleted = await deleteUser(request.params.id);
  if (!deleted) {
    sendJson(response, 404, { success: false, error: 'Account not found' });
    return;
  }
  sendJson(response, 200, { success: true });
});

app.post('/api/admin/reset', async (_request, response) => {
  try {
    const store = getDefaultStoreSnapshot();
    await writeStore(store);
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 500, { success: false, error: String(error.message || error) });
  }
});

app.use((_request, response) => {
  sendJson(response, 404, { error: 'Not found' });
});

const server = app.listen(port, '0.0.0.0', async () => {
  await readStore();
  console.log(`Project INSPIRE backend running at http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing backend process and run npm start again.`);
    return;
  }

  console.error('Backend server failed to start:', error);
});