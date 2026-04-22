import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';

import { projectRoot, referencesDir, supportedModels, surveyQuestions } from './config.js';
import { generateLessonPlan } from './openrouter.js';
import { loadReferenceTextByFileName } from './reference-loader.js';
import { initializeDatabase, closeDatabase } from './database/init.js';
import { authMiddleware } from './auth.middleware.js';
import { hashPassword, verifyPassword } from './utils/password.js';
import { generateToken } from './utils/jwt.js';
import * as db from './db.js';

// Utility functions from store.js that we still need
function normalizeText(value, defaultValue = '') {
  return (value && String(value).trim()) || defaultValue;
}

function normalizeArray(value = []) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item && String(item).trim());
  return [value].filter((item) => item && String(item).trim());
}

dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use((request, response, next) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.path}`);
  if (request.headers.authorization) {
    console.log(`  Authorization: ${request.headers.authorization.substring(0, 20)}...`);
  } else {
    console.log(`  Authorization: MISSING`);
  }
  next();
});
app.use(authMiddleware);
app.use((request, response, next) => {
  const start = Date.now();
  response.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = response.statusCode >= 400 ? 'ERROR' : 'INFO';
    console.log(`  [${level}] ${request.method} ${request.originalUrl} -> ${response.statusCode} (${durationMs}ms)`);
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
    subcategories: normalizeText(lessonData.subcategories),
    custom_support: normalizeText(lessonData.custom_support ?? lessonData.customSupport),
    delivery_mode: normalizeText(lessonData.delivery_mode ?? lessonData.deliveryMode),
    ai_model_used: normalizeText(payload.model),
    reference_docs_used: normalizeArray(payload.references ?? payload.selected_refs),
    generated_output: normalizeText(payload.generated_output),
    generated_parsed: (payload.generated_parsed && typeof payload.generated_parsed === 'object' && !Array.isArray(payload.generated_parsed)) ? payload.generated_parsed : undefined,
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
    affiliated_school: normalizeText(user.affiliated_school),
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
    affiliated_school: normalizeText(payload.affiliated_school ?? payload.affiliatedSchool, 'San Felipe National High School · Basud, Camarines Norte'),
    role,
    active: payload.active !== false
  };
}

function normalizeResourcePayload(body) {
  const payload = ensureObject(body, 'Request body');
  const requestedCategory = normalizeText(payload.category, 'References');
  const allowedCategories = new Set(['Strategies', 'Tips', 'Templates', 'References']);
  const category = allowedCategories.has(requestedCategory) ? requestedCategory : 'References';
  return {
    title: normalizeText(payload.title),
    description: normalizeText(payload.description),
    category
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
  const stats = await db.getStats();
  sendJson(response, 200, {
    ok: true,
    models: supportedModels.length,
    lessons: stats.lessons,
    reflections: stats.reflections,
    observations: stats.observations,
    surveys: stats.surveys
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

    const user = await db.findUserByUsername(username);
    if (!user) {
      sendJson(response, 401, { success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash || '');
    if (!passwordValid) {
      sendJson(response, 401, { success: false, error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = generateToken(user.id, user.username, user.role);

    sendJson(response, 200, {
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/references', async (_request, response) => {
  try {
    const files = await fs.readdir(referencesDir).catch(() => []);
    const references = files.filter((f) => /\.(pdf|docx)$/i.test(f));
    sendJson(response, 200, { references });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/resource-library', async (_request, response) => {
  try {
    const metadata = await db.getReferenceMetadata();
    const files = await fs.readdir(referencesDir).catch(() => []);
    const items = files
      .filter((f) => /\.(pdf|docx)$/i.test(f))
      .map((fileName) => ({
        id: fileName,
        file_name: fileName,
        title: metadata[fileName]?.title || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        description: metadata[fileName]?.description || '',
        category: metadata[fileName]?.category || 'References',
        created_at: metadata[fileName]?.created_at,
        updated_at: metadata[fileName]?.updated_at
      }));
    sendJson(response, 200, { items });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/resource-library/file/:fileName', async (request, response) => {
  try {
    const fileName = sanitizeReferenceFileName(decodeURIComponent(request.params.fileName));
    const targetPath = path.join(referencesDir, fileName);
    const extension = path.extname(fileName).toLowerCase();

    await fs.access(targetPath);
    response.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    response.setHeader('Content-Type', extension === '.pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.sendFile(targetPath);
  } catch (error) {
    sendJson(response, 404, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/resource-library/preview-text/:fileName', async (request, response) => {
  try {
    const fileName = sanitizeReferenceFileName(decodeURIComponent(request.params.fileName));
    const text = await loadReferenceTextByFileName(fileName);
    sendJson(response, 200, { success: true, file_name: fileName, text });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/resource-library/:fileName', async (request, response) => {
  try {
    const fileName = sanitizeReferenceFileName(decodeURIComponent(request.params.fileName));
    const normalized = normalizeResourcePayload(request.body);
    await db.upsertReferenceMetadata(fileName, normalized);
    const metadata = await db.getReferenceMetadata();
    const item = {
      id: fileName,
      file_name: fileName,
      title: metadata[fileName]?.title || normalized.title,
      description: metadata[fileName]?.description || normalized.description,
      category: metadata[fileName]?.category || normalized.category,
      created_at: metadata[fileName]?.created_at,
      updated_at: metadata[fileName]?.updated_at
    };
    sendJson(response, 200, { success: true, item });
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

    const resourcePayload = normalizeResourcePayload(payload);
    await db.upsertReferenceMetadata(fileName, {
      ...resourcePayload,
      title: normalizeText(payload.title, fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    });

    const metadata = await db.getReferenceMetadata();
    const item = {
      id: fileName,
      file_name: fileName,
      title: metadata[fileName]?.title,
      description: metadata[fileName]?.description,
      category: metadata[fileName]?.category,
      created_at: metadata[fileName]?.created_at,
      updated_at: metadata[fileName]?.updated_at
    };

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
    await db.deleteReferenceMetadata(fileName);
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/lessons', async (request, response) => {
  const userId = request.user?.userId || 1;
  const lessons = await db.listLessons(userId);
  sendJson(response, 200, { lessons });
});

app.get('/api/lessons/:id', async (request, response) => {
  const lesson = await db.getLesson(Number(request.params.id));
  if (!lesson) {
    sendJson(response, 404, { error: 'Lesson not found' });
    return;
  }
  sendJson(response, 200, { lesson });
});

app.post('/api/lessons', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const normalized = normalizeLessonPayload(request.body);
    const lesson = await db.upsertLesson({ ...normalized, user_id: userId });
    sendJson(response, 201, { success: true, lesson });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/lessons/:id', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const normalized = normalizeLessonPayload(request.body);
    const lesson = await db.upsertLesson({ ...normalized, id: Number(request.params.id), user_id: userId });
    sendJson(response, 200, { success: true, lesson });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/lessons/:id', async (request, response) => {
  const deleted = await db.deleteLesson(Number(request.params.id));
  if (!deleted) {
    sendJson(response, 404, { success: false, error: 'Lesson not found' });
    return;
  }
  sendJson(response, 200, { success: true });
});

app.post('/api/generate', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const payload = ensureObject(request.body, 'Request body');
    const lessonData = ensureObject(payload.lesson_data ?? payload.lessonData, 'lesson_data');
    const references = normalizeArray(payload.references ?? payload.selected_refs);
    const model = normalizeText(payload.model);

    const generation = await generateLessonPlan(lessonData, { model, selectedRefs: references });
    const lesson = await db.upsertLesson({
      ...normalizeLessonPayload(request.body),
      user_id: userId,
      title: normalizeText(lessonData.title, 'Untitled Lesson'),
      generated_output: generation.output,
      generated_parsed: generation.parsed,
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

app.get('/api/reflections', async (request, response) => {
  const userId = request.user?.userId || 1;
  const reflections = await db.listReflections(userId);
  sendJson(response, 200, { reflections });
});

app.post('/api/reflections', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const body = normalizeReflectionPayload(request.body);
    const record = await db.upsertReflection({ ...body, user_id: userId });
    sendJson(response, 201, { success: true, reflection: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/reflections/:id', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const body = normalizeReflectionPayload(request.body);
    const record = await db.upsertReflection({ ...body, id: Number(request.params.id), user_id: userId });
    sendJson(response, 200, { success: true, reflection: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/reflections/:id', async (request, response) => {
  const deleted = await db.deleteReflection(Number(request.params.id));
  if (!deleted) {
    sendJson(response, 404, { success: false, error: 'Reflection not found' });
    return;
  }
  sendJson(response, 200, { success: true });
});

app.get('/api/observations', async (request, response) => {
  const userId = request.user?.userId || 1;
  const observations = await db.listObservations(userId);
  sendJson(response, 200, { observations });
});

app.post('/api/observations', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const body = normalizeObservationPayload(request.body);
    const record = await db.upsertObservation({ ...body, user_id: userId });
    sendJson(response, 201, { success: true, observation: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/observations/:id', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const body = normalizeObservationPayload(request.body);
    const record = await db.upsertObservation({ ...body, id: Number(request.params.id), user_id: userId });
    sendJson(response, 200, { success: true, observation: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/observations/:id', async (request, response) => {
  const deleted = await db.deleteObservation(Number(request.params.id));
  if (!deleted) {
    sendJson(response, 404, { success: false, error: 'Observation not found' });
    return;
  }
  sendJson(response, 200, { success: true });
});

app.get('/api/surveys/questions', async (_request, response) => {
  sendJson(response, 200, surveyQuestions);
});

app.get('/api/surveys', async (request, response) => {
  const userId = request.user?.userId || 1;
  const surveys = await db.listSurveys(userId);
  sendJson(response, 200, { surveys });
});

app.post('/api/surveys', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const body = normalizeSurveyPayload(request.body);
    const record = await db.upsertSurvey({ ...body, user_id: userId });
    sendJson(response, 201, { success: true, survey: record });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/surveys/:id', async (request, response) => {
  const deleted = await db.deleteSurvey(Number(request.params.id));
  if (!deleted) {
    sendJson(response, 404, { success: false, error: 'Survey not found' });
    return;
  }
  sendJson(response, 200, { success: true });
});

app.get('/api/admin/stats', async (request, response) => {
  try {
    const userId = request.user?.userId || 1;
    const user = await db.getUser(userId);

    const lessons = await db.listLessons(userId);
    const reflections = await db.listReflections(userId);
    const observations = await db.listObservations(userId);
    const surveys = await db.listSurveys(userId);

    const completedPostSurveys = surveys.filter((survey) => survey.survey_type === 'post').length;
    const completedPreSurveys = surveys.filter((survey) => survey.survey_type === 'pre').length;
    const averageEffectiveness = reflections.length
      ? (reflections.reduce((total, reflection) => total + Number(reflection.effectiveness_rating || 0), 0) / reflections.length)
      : 0;

    const difficultyCounts = new Map();
    const supportCounts = new Map();

    for (const lesson of lessons) {
      const difficulty = normalizeText(lesson.difficulty, 'Unspecified');
      difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1);

      const supportTypes = normalizeArray(lesson.support_types);
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

    // Calculate daily survey scores
    const dailyScores = new Map();
    for (const survey of surveys) {
      const date = normalizeText(survey.completed_at, '').split('T')[0];
      const key = `${date}|${survey.survey_type}`;
      
      if (!dailyScores.has(key)) {
        dailyScores.set(key, {
          date,
          survey_type: survey.survey_type,
          individual_scores: [],
          scores_for_average: []
        });
      }

      const entry = dailyScores.get(key);
      const responses = typeof survey.question_responses === 'string'
        ? JSON.parse(survey.question_responses)
        : survey.question_responses || {};

      entry.individual_scores.push(responses);
      const values = Object.values(responses).filter(v => typeof v === 'number');
      entry.scores_for_average.push(...values);
    }

    const daily_survey_scores = Array.from(dailyScores.values()).map(entry => {
      const avgScore = entry.scores_for_average.length
        ? Number((entry.scores_for_average.reduce((a, b) => a + b, 0) / entry.scores_for_average.length).toFixed(1))
        : 0;

      return {
        date: entry.date,
        survey_type: entry.survey_type,
        individual_scores: entry.individual_scores,
        aggregate_score: avgScore
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    sendJson(response, 200, {
      user_id: userId,
      username: user?.username || 'User',
      display_name: user?.display_name || 'User',
      lessons_created: lessons.length,
      reflections_submitted: reflections.length,
      observations_submitted: observations.length,
      survey_completion: `${completedPreSurveys} Pre · ${completedPostSurveys} Post`,
      average_effectiveness_rating: Number(averageEffectiveness.toFixed(1)),
      top_difficulties: topDifficulties,
      top_supports: topSupports,
      daily_survey_scores,
      recent_lessons: lessons.slice(0, 5),
      recent_reflections: reflections.slice(0, 5),
      recent_observations: observations.slice(0, 5),
      recent_surveys: surveys.slice(0, 5)
    });
  } catch (error) {
    sendJson(response, 500, { success: false, error: String(error.message || error) });
  }
});

app.get('/api/admin/accounts', async (_request, response) => {
  try {
    const users = await db.listUsers();
    sendJson(response, 200, { users: users.map(sanitizeUser) });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.post('/api/admin/accounts', async (request, response) => {
  try {
    const payload = normalizeUserPayload(request.body);
    const passwordHash = await hashPassword(payload.password);
    const user = await db.upsertUser({
      username: payload.username,
      password_hash: passwordHash,
      display_name: payload.display_name,
      affiliated_school: payload.affiliated_school,
      role: payload.role,
      active: payload.active
    });
    sendJson(response, 201, { success: true, user: sanitizeUser(user) });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.put('/api/admin/accounts/:id', async (request, response) => {
  try {
    const payload = normalizeUserPayload(request.body);
    const passwordHash = await hashPassword(payload.password);
    const user = await db.upsertUser({
      id: Number(request.params.id),
      username: payload.username,
      password_hash: passwordHash,
      display_name: payload.display_name,
      affiliated_school: payload.affiliated_school,
      role: payload.role,
      active: payload.active
    });
    sendJson(response, 200, { success: true, user: sanitizeUser(user) });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.delete('/api/admin/accounts/:id', async (request, response) => {
  try {
    const deleted = await db.deleteUser(Number(request.params.id));
    if (!deleted) {
      sendJson(response, 404, { success: false, error: 'Account not found' });
      return;
    }
    sendJson(response, 200, { success: true });
  } catch (error) {
    sendJson(response, 400, { success: false, error: String(error.message || error) });
  }
});

app.post('/api/admin/reset', async (_request, response) => {
  try {
    console.warn('⚠️ Admin reset requested - database will not be reset');
    sendJson(response, 200, { success: true, message: 'Reset functionality disabled in production. Please backup your database manually.' });
  } catch (error) {
    sendJson(response, 500, { success: false, error: String(error.message || error) });
  }
});

app.use((_request, response) => {
  sendJson(response, 404, { error: 'Not found' });
});

const server = app.listen(port, '0.0.0.0', async () => {
  try {
    await initializeDatabase();
    console.log(`✓ Project INSPIRE backend running at http://localhost:${port}`);
    console.log(`✓ Database: SQLite (backend/data/inspire.db)`);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing backend process and run npm start again.`);
    return;
  }

  console.error('Backend server failed to start:', error);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await closeDatabase();
  process.exit(0);
});