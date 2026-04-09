import fs from 'node:fs/promises';
import path from 'node:path';

import { dataFilePath, referencesDir, supportedModels, surveyQuestions } from './config.js';

const defaultStore = () => ({
  meta: {
    nextLessonId: 1,
    nextReflectionId: 1,
    nextObservationId: 1,
    nextSurveyId: 3,
    nextUserId: 4
  },
  lessons: [],
  reflections: [],
  observations: [],
  surveys: [
    {
      id: 1,
      survey_type: 'pre',
      question_responses: { q1: 2, q2: 2, q3: 3, q4: 2, q5: 2 },
      completed_at: '2026-04-01T08:00:00.000Z'
    },
    {
      id: 2,
      survey_type: 'post',
      question_responses: { q1: 4, q2: 4, q3: 4, q4: 4, q5: 4 },
      completed_at: '2026-04-08T08:00:00.000Z'
    }
  ],
  users: [
    {
      id: 1,
      username: 'admin',
      password: 'password123',
      display_name: 'Janice D. Quinones',
      role: 'admin',
      active: true,
      created_at: '2026-04-01T08:00:00.000Z',
      updated_at: '2026-04-01T08:00:00.000Z'
    },
    {
      id: 2,
      username: 'teacher',
      password: 'password123',
      display_name: 'Janice D. Quinones',
      role: 'teacher',
      active: true,
      created_at: '2026-04-01T08:00:00.000Z',
      updated_at: '2026-04-01T08:00:00.000Z'
    },
    {
      id: 3,
      username: 'researcher',
      password: 'password123',
      display_name: 'Research Coordinator',
      role: 'researcher',
      active: true,
      created_at: '2026-04-01T08:00:00.000Z',
      updated_at: '2026-04-01T08:00:00.000Z'
    }
  ],
  reference_metadata: {},
  models: supportedModels,
  surveyQuestions
});

function titleFromFilename(fileName) {
  return normalizeText(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveReferenceMetadata(fileName) {
  const baseName = normalizeText(fileName).toLowerCase();
  const fallbackTitle = titleFromFilename(fileName);

  if (baseName.includes('assessment-checklist')) {
    return {
      title: 'Learner Difficulty Assessment Checklist',
      description: 'Comprehensive checklist of learner difficulty categories, indicators, and classroom support strategies.',
      category: 'Tips'
    };
  }

  if (baseName.includes('revised k to 12 dlp')) {
    return {
      title: 'Revised K to 12 Daily Lesson Plan Guide',
      description: 'Template and guide for writing standards-aligned daily lesson plans in the K to 12 curriculum.',
      category: 'Templates'
    };
  }

  if (baseName.includes('dsm-5')) {
    return {
      title: 'DSM-5 Reference for Learning and Behavior Needs',
      description: 'Diagnostic reference to support interpretation of learner characteristics and intervention planning.',
      category: 'References'
    };
  }

  if (baseName.includes('legal basis')) {
    return {
      title: 'Legal Basis for Inclusive Education',
      description: 'Policy and legal foundations supporting inclusive education implementation in schools.',
      category: 'References'
    };
  }

  if (baseName.includes('do_s2021_044')) {
    return {
      title: 'DO s.2021 No.044 - Inclusive Education Policy Framework',
      description: 'Official policy guidance for implementing inclusive education principles and learner support.',
      category: 'References'
    };
  }

  if (baseName.includes('do_s2020_021') || baseName.includes('transition')) {
    return {
      title: 'DO s.2020 No.021 - Transition Program Guidance',
      description: 'Guidance for transition planning and learner progression across educational stages.',
      category: 'Strategies'
    };
  }

  if (baseName.includes('action research')) {
    return {
      title: 'Action Research Proposal for Inclusive Teaching',
      description: 'School-based action research document focused on inclusive teaching practices and outcomes.',
      category: 'References'
    };
  }

  return {
    title: fallbackTitle,
    description: 'Reference material available for planning inclusive lessons and classroom interventions.',
    category: 'References'
  };
}

function shouldAutofillTitle(currentTitle, fallbackTitle) {
  const normalized = normalizeText(currentTitle).toLowerCase();
  if (!normalized) {
    return true;
  }

  return normalized === 'updated title' || normalized === normalizeText(fallbackTitle).toLowerCase();
}

function shouldAutofillDescription(currentDescription) {
  const normalized = normalizeText(currentDescription).toLowerCase();
  if (!normalized) {
    return true;
  }

  return normalized === 'updated description' || normalized === 'ready for selection in the lesson workbench.';
}

function shouldAutofillCategory(currentCategory) {
  const normalized = normalizeText(currentCategory);
  if (!normalized) {
    return true;
  }

  if (normalized.toLowerCase() === 'updated category') {
    return true;
  }

  const allowed = new Set(['Strategies', 'Tips', 'Templates', 'Videos', 'References']);
  return !allowed.has(normalized);
}

function normalizeStore(store) {
  const fallback = defaultStore();
  return {
    ...fallback,
    ...store,
    meta: {
      ...fallback.meta,
      ...(store.meta || {})
    },
    lessons: Array.isArray(store.lessons) ? store.lessons : fallback.lessons,
    reflections: Array.isArray(store.reflections) ? store.reflections : fallback.reflections,
    observations: Array.isArray(store.observations) ? store.observations : fallback.observations,
    surveys: Array.isArray(store.surveys) ? store.surveys : fallback.surveys,
    users: Array.isArray(store.users) ? store.users : fallback.users,
    reference_metadata: (store.reference_metadata && typeof store.reference_metadata === 'object' && !Array.isArray(store.reference_metadata))
      ? store.reference_metadata
      : fallback.reference_metadata,
    models: Array.isArray(store.models) ? store.models : fallback.models,
    surveyQuestions: store.surveyQuestions || fallback.surveyQuestions
  };
}

let cachedStore = null;

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, JSON.stringify(defaultStore(), null, 2), 'utf-8');
  }
}

export async function readStore() {
  if (cachedStore) {
    return cachedStore;
  }

  await ensureStoreFile();
  const raw = await fs.readFile(dataFilePath, 'utf-8');
  cachedStore = normalizeStore(JSON.parse(raw));
  return cachedStore;
}

export async function writeStore(nextStore) {
  cachedStore = normalizeStore(nextStore);
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  await fs.writeFile(dataFilePath, JSON.stringify(cachedStore, null, 2), 'utf-8');
  return cachedStore;
}

export async function resetStore() {
  return writeStore(defaultStore());
}

export function nextNumericId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

export function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => normalizeText(item)).filter(Boolean);
  }

  return [];
}

export function getReferenceNames() {
  return fs.readdir(referencesDir, { withFileTypes: true }).then((entries) =>
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(pdf|docx)$/i.test(name))
      .sort((left, right) => left.localeCompare(right))
  );
}

export async function getReferenceLibraryItems() {
  const [store, files] = await Promise.all([readStore(), getReferenceNames()]);
  let hasMetadataChanges = false;

  for (const fileName of files) {
    const existing = store.reference_metadata[fileName] || {};
    const inferred = deriveReferenceMetadata(fileName);
    const fallbackTitle = titleFromFilename(fileName);
    const currentTitle = normalizeText(existing.title);
    const currentDescription = normalizeText(existing.description);
    const currentCategory = normalizeText(existing.category);

    const nextTitle = shouldAutofillTitle(currentTitle, fallbackTitle) ? inferred.title : currentTitle;
    const nextDescription = shouldAutofillDescription(currentDescription) ? inferred.description : currentDescription;
    const nextCategory = shouldAutofillCategory(currentCategory) ? inferred.category : currentCategory;

    const needsUpdate =
      !existing.created_at ||
      currentTitle !== nextTitle ||
      currentDescription !== nextDescription ||
      currentCategory !== nextCategory;

    if (needsUpdate) {
      const timestamp = new Date().toISOString();
      store.reference_metadata[fileName] = {
        ...existing,
        title: normalizeText(nextTitle, fallbackTitle),
        description: normalizeText(nextDescription, inferred.description),
        category: normalizeText(nextCategory, inferred.category),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp
      };
      hasMetadataChanges = true;
    }
  }

  if (hasMetadataChanges) {
    await writeStore(store);
  }

  return files.map((fileName) => {
    const metadata = store.reference_metadata[fileName] || {};
    return {
      id: fileName,
      file_name: fileName,
      title: normalizeText(metadata.title, titleFromFilename(fileName)),
      description: normalizeText(metadata.description, 'Ready for selection in the lesson workbench.'),
      category: normalizeText(metadata.category, 'References'),
      created_at: metadata.created_at,
      updated_at: metadata.updated_at
    };
  });
}

export async function upsertReferenceMetadata(fileName, metadataPatch) {
  const store = await readStore();
  const key = normalizeText(fileName);
  const existing = store.reference_metadata[key] || {};
  const timestamp = new Date().toISOString();

  store.reference_metadata[key] = {
    ...existing,
    ...metadataPatch,
    title: normalizeText(metadataPatch.title ?? existing.title, titleFromFilename(key)),
    description: normalizeText(metadataPatch.description ?? existing.description, 'Ready for selection in the lesson workbench.'),
    category: normalizeText(metadataPatch.category ?? existing.category, 'References'),
    created_at: existing.created_at || timestamp,
    updated_at: timestamp
  };

  await writeStore(store);

  return {
    id: key,
    file_name: key,
    title: store.reference_metadata[key].title,
    description: store.reference_metadata[key].description,
    category: store.reference_metadata[key].category,
    created_at: store.reference_metadata[key].created_at,
    updated_at: store.reference_metadata[key].updated_at
  };
}

export async function deleteReferenceMetadata(fileName) {
  const store = await readStore();
  const key = normalizeText(fileName);

  if (store.reference_metadata[key]) {
    delete store.reference_metadata[key];
    await writeStore(store);
  }

  return true;
}

export async function upsertLesson(record) {
  const store = await readStore();
  const id = record.id ? Number(record.id) : nextNumericId(store.lessons);
  const timestamp = new Date().toISOString();
  const existingIndex = store.lessons.findIndex((lesson) => Number(lesson.id) === id);
  const nextRecord = {
    ...record,
    id,
    updated_at: timestamp,
    created_at: existingIndex >= 0 ? store.lessons[existingIndex].created_at : timestamp
  };

  if (existingIndex >= 0) {
    store.lessons[existingIndex] = nextRecord;
  } else {
    store.lessons.unshift(nextRecord);
  }

  await writeStore(store);
  return nextRecord;
}

export async function upsertReflection(record) {
  const store = await readStore();
  const id = record.id ? Number(record.id) : nextNumericId(store.reflections);
  const timestamp = new Date().toISOString();
  const existingIndex = store.reflections.findIndex((item) => Number(item.id) === id);
  const nextRecord = {
    ...record,
    id,
    updated_at: timestamp,
    created_at: existingIndex >= 0 ? store.reflections[existingIndex].created_at : timestamp
  };

  if (existingIndex >= 0) {
    store.reflections[existingIndex] = nextRecord;
  } else {
    store.reflections.unshift(nextRecord);
  }

  await writeStore(store);
  return nextRecord;
}

export async function upsertObservation(record) {
  const store = await readStore();
  const id = record.id ? Number(record.id) : nextNumericId(store.observations);
  const timestamp = new Date().toISOString();
  const existingIndex = store.observations.findIndex((item) => Number(item.id) === id);
  const nextRecord = {
    ...record,
    id,
    updated_at: timestamp,
    created_at: existingIndex >= 0 ? store.observations[existingIndex].created_at : timestamp
  };

  if (existingIndex >= 0) {
    store.observations[existingIndex] = nextRecord;
  } else {
    store.observations.unshift(nextRecord);
  }

  await writeStore(store);
  return nextRecord;
}

export async function upsertSurvey(record) {
  const store = await readStore();
  const id = record.id ? Number(record.id) : nextNumericId(store.surveys);
  const timestamp = new Date().toISOString();
  const existingIndex = store.surveys.findIndex((item) => Number(item.id) === id);
  const nextRecord = {
    ...record,
    id,
    completed_at: record.completed_at ?? timestamp
  };

  if (existingIndex >= 0) {
    store.surveys[existingIndex] = nextRecord;
  } else {
    store.surveys.unshift(nextRecord);
  }

  await writeStore(store);
  return nextRecord;
}

export async function deleteSurvey(id) {
  const store = await readStore();
  const currentLength = store.surveys.length;
  store.surveys = store.surveys.filter((item) => Number(item.id) !== Number(id));

  if (store.surveys.length === currentLength) {
    return false;
  }

  await writeStore(store);
  return true;
}

export async function listUsers() {
  const store = await readStore();
  return store.users;
}

export async function findUserByCredentials(username, password) {
  const store = await readStore();
  const normalizedUsername = normalizeText(username).toLowerCase();
  const normalizedPassword = normalizeText(password);

  return store.users.find((user) =>
    user.active !== false &&
    normalizeText(user.username).toLowerCase() === normalizedUsername &&
    normalizeText(user.password) === normalizedPassword
  ) || null;
}

export async function upsertUser(record) {
  const store = await readStore();
  const id = record.id ? Number(record.id) : nextNumericId(store.users);
  const timestamp = new Date().toISOString();
  const existingIndex = store.users.findIndex((item) => Number(item.id) === id);
  const nextRecord = {
    ...record,
    id,
    role: normalizeText(record.role).toLowerCase(),
    username: normalizeText(record.username).toLowerCase(),
    active: record.active !== false,
    updated_at: timestamp,
    created_at: existingIndex >= 0 ? store.users[existingIndex].created_at : timestamp
  };

  if (existingIndex >= 0) {
    store.users[existingIndex] = nextRecord;
  } else {
    store.users.unshift(nextRecord);
  }

  await writeStore(store);
  return nextRecord;
}

export async function deleteUser(id) {
  const store = await readStore();
  const currentLength = store.users.length;
  store.users = store.users.filter((item) => Number(item.id) !== Number(id));

  if (store.users.length === currentLength) {
    return false;
  }

  await writeStore(store);
  return true;
}

export function getDefaultStoreSnapshot() {
  return defaultStore();
}