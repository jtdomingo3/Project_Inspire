import { getDatabase } from './database/init.js';
import { promisify } from 'util';
import {
  getDefaultUserLlmSettings,
  llmProviderApiKeyFields,
  normalizeLlmProvider,
  sanitizeStoredLlmSettings,
  trimOptional
} from './llm-provider.js';

function promisifyDb(db) {
  return {
    run: promisify(db.run.bind(db)),
    get: promisify(db.get.bind(db)),
    all: promisify(db.all.bind(db)),
  };
}

function serializeJson(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return JSON.stringify(obj);
}

function deserializeJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export async function upsertLesson(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    user_id = 1,
    subject,
    grade,
    quarter,
    title,
    objectives,
    difficulty,
    indicators,
    support_types,
    subcategories,
    custom_support,
    delivery_mode,
    status = 'draft',
    ai_model_used,
    reference_docs_used = [],
    generated_output,
    generated_parsed,
    lesson_data,
  } = record;

  const now = new Date().toISOString();
  const refDocs = serializeJson(reference_docs_used);
  const genParsed = serializeJson(generated_parsed);
  const lsnData = serializeJson(lesson_data);

  if (id) {
    await pDb.run(
      `UPDATE lessons SET
        subject = ?, grade = ?, quarter = ?, title = ?, objectives = ?,
        difficulty = ?, indicators = ?, support_types = ?, subcategories = ?,
        custom_support = ?, delivery_mode = ?, status = ?, ai_model_used = ?,
        reference_docs_used = ?, generated_output = ?, generated_parsed = ?,
        lesson_data = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
      [
        subject,
        grade,
        quarter,
        title,
        objectives,
        difficulty,
        indicators,
        support_types,
        subcategories,
        custom_support,
        delivery_mode,
        status,
        ai_model_used,
        refDocs,
        generated_output,
        genParsed,
        lsnData,
        now,
        id,
        user_id,
      ]
    );
  } else {
    await pDb.run(
      `INSERT INTO lessons (
        user_id, subject, grade, quarter, title, objectives,
        difficulty, indicators, support_types, subcategories,
        custom_support, delivery_mode, status, ai_model_used,
        reference_docs_used, generated_output, generated_parsed,
        lesson_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        subject,
        grade,
        quarter,
        title,
        objectives,
        difficulty,
        indicators,
        support_types,
        subcategories,
        custom_support,
        delivery_mode,
        status,
        ai_model_used,
        refDocs,
        generated_output,
        genParsed,
        lsnData,
        now,
        now,
      ]
    );
  }

  const result = id
    ? await pDb.get('SELECT * FROM lessons WHERE id = ? AND user_id = ?', [id, user_id])
    : await pDb.get('SELECT * FROM lessons WHERE id = last_insert_rowid()');

  return formatLesson(result);
}

function formatLesson(row) {
  if (!row) return null;
  return {
    ...row,
    reference_docs_used: deserializeJson(row.reference_docs_used) || [],
    generated_parsed: deserializeJson(row.generated_parsed),
    lesson_data: deserializeJson(row.lesson_data),
  };
}

export async function deleteLesson(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM lessons WHERE id = ?', [id]);
  return true;
}

export async function listLessons(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  let query = 'SELECT * FROM lessons';
  let params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params = [userId];
  }

  query += ' ORDER BY created_at DESC';

  const rows = await pDb.all(query, params);
  return rows.map(formatLesson);
}

export async function getLesson(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const row = await pDb.get('SELECT * FROM lessons WHERE id = ?', [id]);
  return formatLesson(row);
}

export async function upsertReflection(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    user_id = 1,
    date,
    subject,
    grade,
    lesson_plan_linked,
    strategies_used,
    learner_response,
    worked_well,
    needs_improvement,
    effectiveness_rating,
    inspire_confidence_rating,
    challenges,
    next_steps,
  } = record;

  const now = new Date().toISOString();

  if (id) {
    await pDb.run(
      `UPDATE reflections SET
        date = ?, subject = ?, grade = ?, lesson_plan_linked = ?,
        strategies_used = ?, learner_response = ?, worked_well = ?,
        needs_improvement = ?, effectiveness_rating = ?,
        inspire_confidence_rating = ?, challenges = ?, next_steps = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
      [
        date,
        subject,
        grade,
        lesson_plan_linked,
        strategies_used,
        learner_response,
        worked_well,
        needs_improvement,
        effectiveness_rating,
        inspire_confidence_rating,
        challenges,
        next_steps,
        now,
        id,
        user_id,
      ]
    );
  } else {
    await pDb.run(
      `INSERT INTO reflections (
        user_id, date, subject, grade, lesson_plan_linked,
        strategies_used, learner_response, worked_well,
        needs_improvement, effectiveness_rating,
        inspire_confidence_rating, challenges, next_steps, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        date,
        subject,
        grade,
        lesson_plan_linked,
        strategies_used,
        learner_response,
        worked_well,
        needs_improvement,
        effectiveness_rating,
        inspire_confidence_rating,
        challenges,
        next_steps,
        now,
        now,
      ]
    );
  }

  const result = id
    ? await pDb.get('SELECT * FROM reflections WHERE id = ? AND user_id = ?', [id, user_id])
    : await pDb.get('SELECT * FROM reflections WHERE id = last_insert_rowid()');

  return result;
}

export async function deleteReflection(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM reflections WHERE id = ?', [id]);
  return true;
}

export async function listReflections(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  let query = 'SELECT * FROM reflections';
  let params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params = [userId];
  }

  query += ' ORDER BY created_at DESC';

  const rows = await pDb.all(query, params);
  return rows;
}

export async function upsertObservation(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    user_id = 1,
    observation_date,
    teacher_observed,
    subject,
    focus,
    phase,
    rating,
    notes,
  } = record;

  const now = new Date().toISOString();

  if (id) {
    await pDb.run(
      `UPDATE observations SET
        observation_date = ?, teacher_observed = ?, subject = ?,
        focus = ?, phase = ?, rating = ?, notes = ?
      WHERE id = ? AND user_id = ?`,
      [observation_date, teacher_observed, subject, focus, phase, rating, notes, id, user_id]
    );
  } else {
    await pDb.run(
      `INSERT INTO observations (
        user_id, observation_date, teacher_observed, subject,
        focus, phase, rating, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, observation_date, teacher_observed, subject, focus, phase, rating, notes, now]
    );
  }

  const result = id
    ? await pDb.get('SELECT * FROM observations WHERE id = ? AND user_id = ?', [id, user_id])
    : await pDb.get('SELECT * FROM observations WHERE id = last_insert_rowid()');

  return result;
}

export async function deleteObservation(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM observations WHERE id = ?', [id]);
  return true;
}

export async function listObservations(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  let query = 'SELECT * FROM observations';
  let params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params = [userId];
  }

  query += ' ORDER BY created_at DESC';

  const rows = await pDb.all(query, params);
  return rows;
}

export async function upsertSurvey(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const { id, user_id = 1, survey_type, example_label, question_responses } = record;
  const responses = serializeJson(question_responses);

  if (id) {
    await pDb.run(
      `UPDATE surveys SET
        survey_type = ?, example_label = ?, question_responses = ?
      WHERE id = ? AND user_id = ?`,
      [survey_type, example_label, responses, id, user_id]
    );
  } else {
    const now = new Date().toISOString();
    await pDb.run(
      `INSERT INTO surveys (user_id, survey_type, example_label, question_responses, completed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, survey_type, example_label, responses, now]
    );
  }

  const result = id
    ? await pDb.get('SELECT * FROM surveys WHERE id = ? AND user_id = ?', [id, user_id])
    : await pDb.get('SELECT * FROM surveys WHERE id = last_insert_rowid()');

  return {
    ...result,
    question_responses: deserializeJson(result.question_responses),
  };
}

export async function deleteSurvey(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM surveys WHERE id = ?', [id]);
  return true;
}

export async function listSurveys(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  let query = 'SELECT * FROM surveys';
  let params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params = [userId];
  }

  query += ' ORDER BY completed_at DESC';

  const rows = await pDb.all(query, params);
  return rows.map((row) => ({
    ...row,
    question_responses: deserializeJson(row.question_responses),
  }));
}

export async function upsertUser(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    username,
    password_hash,
    display_name,
    affiliated_school,
    designation,
    employee_id,
    supervisor,
    principal,
    subject_area,
    grade_level_handled,
    years_experience = 0,
    special_education_training = false,
    research_consent = false,
    role = 'teacher',
    active = true,
  } = record;

  const now = new Date().toISOString();

  if (id) {
    let query = `UPDATE users SET
        username = ?, display_name = ?,
        affiliated_school = ?, designation = ?, employee_id = ?,
        supervisor = ?, principal = ?, subject_area = ?,
        grade_level_handled = ?, years_experience = ?,
        special_education_training = ?, research_consent = ?,
        role = ?, active = ?, updated_at = ?`;
    let params = [
      username, display_name, affiliated_school, designation, employee_id,
      supervisor, principal, subject_area, grade_level_handled, years_experience,
      special_education_training ? 1 : 0, research_consent ? 1 : 0,
      role, active ? 1 : 0, now
    ];

    if (password_hash) {
      query += `, password_hash = ?`;
      params.push(password_hash);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await pDb.run(query, params);
    const result = await pDb.get('SELECT * FROM users WHERE id = ?', [id]);
    return sanitizeUser(result);
  } else {
    await pDb.run(
      `INSERT INTO users (
        username, password_hash, display_name, affiliated_school,
        designation, employee_id, supervisor, principal,
        subject_area, grade_level_handled, years_experience,
        special_education_training, research_consent,
        role, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username, password_hash || '', display_name, affiliated_school,
        designation, employee_id, supervisor, principal,
        subject_area, grade_level_handled, years_experience,
        special_education_training ? 1 : 0, research_consent ? 1 : 0,
        role, active ? 1 : 0, now, now
      ]
    );
    const result = await pDb.get('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!result) {
      throw new Error('User not found after upsert');
    }
    return sanitizeUser(result);
  }
}

export async function updateUserPassword(userId, passwordHash) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const now = new Date().toISOString();
  await pDb.run(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, now, userId]
  );
  return true;
}

export async function deleteUser(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM users WHERE id = ?', [id]);
  return true;
}

export async function findUserByUsername(username) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const result = await pDb.get('SELECT * FROM users WHERE username = ?', [
    username.toLowerCase(),
  ]);

  return result ? result : null;
}

export async function getUser(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const result = await pDb.get('SELECT * FROM users WHERE id = ?', [id]);
  return result ? sanitizeUser(result) : null;
}

export async function listUsers() {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const rows = await pDb.all('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(sanitizeUser);
}

function normalizeUserId(userId) {
  const parsed = Number(userId || 1);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.trunc(parsed);
}

function normalizeStoredLlmSettingsRow(row, userId) {
  const defaults = getDefaultUserLlmSettings(userId);
  if (!row) {
    return defaults;
  }

  return {
    ...defaults,
    user_id: normalizeUserId(row.user_id ?? userId),
    provider: normalizeLlmProvider(row.provider),
    preferred_model: trimOptional(row.preferred_model),
    openrouter_api_key: trimOptional(row.openrouter_api_key),
    openai_api_key: trimOptional(row.openai_api_key),
    anthropic_api_key: trimOptional(row.anthropic_api_key),
    google_api_key: trimOptional(row.google_api_key),
    xai_api_key: trimOptional(row.xai_api_key)
  };
}

function applyApiKeyPatch(currentValue, incomingValue, clearRequested) {
  if (clearRequested) {
    return '';
  }

  if (incomingValue === undefined || incomingValue === null) {
    return trimOptional(currentValue);
  }

  const nextValue = trimOptional(incomingValue);
  if (!nextValue) {
    return trimOptional(currentValue);
  }

  return nextValue;
}

export async function getUserLlmSettingsWithSecrets(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const normalizedUserId = normalizeUserId(userId);

  const row = await pDb.get('SELECT * FROM user_llm_settings WHERE user_id = ?', [normalizedUserId]);
  return normalizeStoredLlmSettingsRow(row, normalizedUserId);
}

export async function getUserLlmSettings(userId) {
  const settings = await getUserLlmSettingsWithSecrets(userId);
  return sanitizeStoredLlmSettings(settings);
}

export async function upsertUserLlmSettings(userId, patch = {}) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const normalizedUserId = normalizeUserId(userId);
  const current = await getUserLlmSettingsWithSecrets(normalizedUserId);
  const allowedClearFields = new Set(Object.values(llmProviderApiKeyFields));
  const clearKeys = new Set(
    Array.isArray(patch.clear_keys)
      ? patch.clear_keys
        .map((value) => trimOptional(value))
        .filter((value) => allowedClearFields.has(value))
      : []
  );

  const next = {
    ...current,
    user_id: normalizedUserId,
    provider: patch.provider !== undefined
      ? normalizeLlmProvider(patch.provider)
      : current.provider,
    preferred_model: patch.preferred_model !== undefined
      ? trimOptional(patch.preferred_model)
      : trimOptional(current.preferred_model),
    openrouter_api_key: applyApiKeyPatch(current.openrouter_api_key, patch.openrouter_api_key, clearKeys.has('openrouter_api_key')),
    openai_api_key: applyApiKeyPatch(current.openai_api_key, patch.openai_api_key, clearKeys.has('openai_api_key')),
    anthropic_api_key: applyApiKeyPatch(current.anthropic_api_key, patch.anthropic_api_key, clearKeys.has('anthropic_api_key')),
    google_api_key: applyApiKeyPatch(current.google_api_key, patch.google_api_key, clearKeys.has('google_api_key')),
    xai_api_key: applyApiKeyPatch(current.xai_api_key, patch.xai_api_key, clearKeys.has('xai_api_key'))
  };

  const now = new Date().toISOString();
  await pDb.run(
    `INSERT INTO user_llm_settings (
      user_id, provider, preferred_model,
      openrouter_api_key, openai_api_key, anthropic_api_key, google_api_key, xai_api_key,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      provider = excluded.provider,
      preferred_model = excluded.preferred_model,
      openrouter_api_key = excluded.openrouter_api_key,
      openai_api_key = excluded.openai_api_key,
      anthropic_api_key = excluded.anthropic_api_key,
      google_api_key = excluded.google_api_key,
      xai_api_key = excluded.xai_api_key,
      updated_at = excluded.updated_at`,
    [
      next.user_id,
      next.provider,
      next.preferred_model,
      next.openrouter_api_key,
      next.openai_api_key,
      next.anthropic_api_key,
      next.google_api_key,
      next.xai_api_key,
      now,
      now
    ]
  );

  return getUserLlmSettings(normalizedUserId);
}

export async function upsertReferenceMetadata(fileName, metadata) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const { title = '', description = '', category = 'References' } = metadata;
  const now = new Date().toISOString();

  await pDb.run(
    `INSERT OR REPLACE INTO reference_documents (filename, title, description, category, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [fileName, title, description, category, now]
  );
}

export async function deleteReferenceMetadata(fileName) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  await pDb.run('DELETE FROM reference_documents WHERE filename = ?', [fileName]);
  return true;
}

export async function getReferenceMetadata() {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const rows = await pDb.all('SELECT * FROM reference_documents');

  const result = {};
  for (const row of rows) {
    result[row.filename] = {
      title: row.title,
      description: row.description,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  return result;
}

function formatDifficultyCategory(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || '',
    observable_characteristics: deserializeJson(row.observable_characteristics) || [],
    subcategories: deserializeJson(row.subcategories) || [],
    accommodation_tips: row.accommodation_tips || '',
    referral_note: row.referral_note || '',
    has_subcategories: row.has_subcategories === 1
  };
}

export async function listDifficultyCategories() {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const rows = await pDb.all('SELECT * FROM difficulty_categories ORDER BY id ASC');
  return rows.map(formatDifficultyCategory);
}

export async function upsertDifficultyCategory(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    name,
    description = '',
    observable_characteristics = [],
    subcategories = [],
    accommodation_tips = '',
    referral_note = '',
    has_subcategories = false
  } = record;

  if (id) {
    await pDb.run(
      `UPDATE difficulty_categories
       SET name = ?, description = ?, observable_characteristics = ?, subcategories = ?,
           accommodation_tips = ?, referral_note = ?, has_subcategories = ?
       WHERE id = ?`,
      [
        name,
        description,
        serializeJson(observable_characteristics),
        serializeJson(subcategories),
        accommodation_tips,
        referral_note,
        has_subcategories ? 1 : 0,
        id
      ]
    );
    const updated = await pDb.get('SELECT * FROM difficulty_categories WHERE id = ?', [id]);
    return updated ? formatDifficultyCategory(updated) : null;
  }

  await pDb.run(
    `INSERT INTO difficulty_categories (
      name, description, observable_characteristics, subcategories, accommodation_tips, referral_note, has_subcategories
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description,
      serializeJson(observable_characteristics),
      serializeJson(subcategories),
      accommodation_tips,
      referral_note,
      has_subcategories ? 1 : 0
    ]
  );

  const inserted = await pDb.get('SELECT * FROM difficulty_categories WHERE id = last_insert_rowid()');
  return inserted ? formatDifficultyCategory(inserted) : null;
}

export async function deleteDifficultyCategory(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM difficulty_categories WHERE id = ?', [id]);
  return true;
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    affiliated_school: user.affiliated_school,
    designation: user.designation,
    employee_id: user.employee_id,
    supervisor: user.supervisor,
    principal: user.principal,
    subject_area: user.subject_area,
    grade_level_handled: user.grade_level_handled,
    years_experience: Number(user.years_experience || 0),
    active: user.active === 1 || user.active === true,
    special_education_training: user.special_education_training === 1 || user.special_education_training === true,
    research_consent: user.research_consent === 1 || user.research_consent === true,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function upsertReminder(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const {
    id,
    user_id = 1,
    content,
    due_date,
    is_completed = false,
  } = record;

  const now = new Date().toISOString();

  if (id) {
    await pDb.run(
      `UPDATE reminders SET
        content = ?, due_date = ?, is_completed = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`,
      [content, due_date, is_completed ? 1 : 0, now, id, user_id]
    );
  } else {
    await pDb.run(
      `INSERT INTO reminders (
        user_id, content, due_date, is_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, content, due_date, is_completed ? 1 : 0, now, now]
    );
  }

  const result = id
    ? await pDb.get('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, user_id])
    : await pDb.get('SELECT * FROM reminders WHERE id = last_insert_rowid()');

  return { ...result, is_completed: result.is_completed === 1 };
}

export async function deleteReminder(id) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run('DELETE FROM reminders WHERE id = ?', [id]);
  return true;
}

export async function listReminders(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  let query = 'SELECT * FROM reminders';
  let params = [];

  if (userId) {
    query += ' WHERE user_id = ?';
    params = [userId];
  }

  query += ' ORDER BY created_at DESC';

  const rows = await pDb.all(query, params);
  return rows.map(row => ({ ...row, is_completed: row.is_completed === 1 }));
}

function formatAssistantConversationRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: row.title || 'New Conversation',
    last_model: row.last_model || '',
    references: deserializeJson(row.reference_docs) || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message: row.last_message || '',
    message_count: Number(row.message_count || 0)
  };
}

function formatAssistantMessageRow(row) {
  return {
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    user_id: Number(row.user_id),
    role: row.role,
    content: row.content,
    sources: deserializeJson(row.sources) || [],
    created_at: row.created_at
  };
}

export async function createAssistantConversation(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const now = new Date().toISOString();
  const userId = Number(record.user_id || 1);
  const title = (record.title && String(record.title).trim()) || 'New Conversation';
  const lastModel = record.last_model || '';
  const referenceDocs = serializeJson(Array.isArray(record.references) ? record.references : []);

  await pDb.run(
    `INSERT INTO assistant_conversations (user_id, title, last_model, reference_docs, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [userId, title, lastModel, referenceDocs, now, now]
  );

  const inserted = await pDb.get('SELECT * FROM assistant_conversations WHERE id = last_insert_rowid()');
  return formatAssistantConversationRow(inserted);
}

export async function listAssistantConversations(userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  const uid = Number(userId || 1);

  const rows = await pDb.all(
    `SELECT c.*,
      (SELECT m.content FROM assistant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*) FROM assistant_messages m WHERE m.conversation_id = c.id) AS message_count
     FROM assistant_conversations c
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC`,
    [uid]
  );

  return rows.map(formatAssistantConversationRow);
}

export async function getAssistantConversation(conversationId, userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const row = await pDb.get(
    `SELECT c.*,
      (SELECT m.content FROM assistant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*) FROM assistant_messages m WHERE m.conversation_id = c.id) AS message_count
     FROM assistant_conversations c
     WHERE c.id = ? AND c.user_id = ?`,
    [Number(conversationId), Number(userId || 1)]
  );

  if (!row) return null;

  const messages = await pDb.all(
    'SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY id ASC',
    [Number(conversationId)]
  );

  return {
    ...formatAssistantConversationRow(row),
    messages: messages.map(formatAssistantMessageRow)
  };
}

export async function updateAssistantConversation(conversationId, userId, patch) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const current = await pDb.get(
    'SELECT * FROM assistant_conversations WHERE id = ? AND user_id = ?',
    [Number(conversationId), Number(userId || 1)]
  );

  if (!current) {
    return null;
  }

  const nextTitle = patch.title !== undefined ? (String(patch.title || '').trim() || current.title) : current.title;
  const nextModel = patch.last_model !== undefined ? String(patch.last_model || '') : current.last_model;
  const nextReferenceDocs = patch.references !== undefined
    ? serializeJson(Array.isArray(patch.references) ? patch.references : [])
    : current.reference_docs;
  const now = new Date().toISOString();

  await pDb.run(
    `UPDATE assistant_conversations
     SET title = ?, last_model = ?, reference_docs = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [nextTitle, nextModel, nextReferenceDocs, now, Number(conversationId), Number(userId || 1)]
  );

  return getAssistantConversation(conversationId, userId);
}

export async function addAssistantMessage(record) {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  await pDb.run(
    `INSERT INTO assistant_messages (conversation_id, user_id, role, content, sources, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(record.conversation_id),
      Number(record.user_id || 1),
      record.role,
      String(record.content || ''),
      serializeJson(Array.isArray(record.sources) ? record.sources : []),
      new Date().toISOString()
    ]
  );

  await pDb.run(
    'UPDATE assistant_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
    [new Date().toISOString(), Number(record.conversation_id), Number(record.user_id || 1)]
  );

  const inserted = await pDb.get('SELECT * FROM assistant_messages WHERE id = last_insert_rowid()');
  return formatAssistantMessageRow(inserted);
}

export async function deleteAssistantConversation(conversationId, userId) {
  const db = getDatabase();
  const pDb = promisifyDb(db);
  await pDb.run(
    'DELETE FROM assistant_conversations WHERE id = ? AND user_id = ?',
    [Number(conversationId), Number(userId || 1)]
  );
  return true;
}

export async function getStats() {
  const db = getDatabase();
  const pDb = promisifyDb(db);

  const lessonCount = await pDb.get(
    'SELECT COUNT(*) as count FROM lessons'
  );
  const reflectionCount = await pDb.get(
    'SELECT COUNT(*) as count FROM reflections'
  );
  const observationCount = await pDb.get(
    'SELECT COUNT(*) as count FROM observations'
  );
  const surveyCount = await pDb.get(
    'SELECT COUNT(*) as count FROM surveys'
  );
  const userCount = await pDb.get(
    'SELECT COUNT(*) as count FROM users'
  );

  return {
    lessons: lessonCount.count,
    reflections: reflectionCount.count,
    observations: observationCount.count,
    surveys: surveyCount.count,
    users: userCount.count,
  };
}

export default {
  upsertLesson,
  deleteLesson,
  listLessons,
  getLesson,
  upsertReflection,
  deleteReflection,
  listReflections,
  upsertObservation,
  deleteObservation,
  listObservations,
  upsertSurvey,
  deleteSurvey,
  listSurveys,
  upsertUser,
  deleteUser,
  findUserByUsername,
  getUserLlmSettings,
  getUserLlmSettingsWithSecrets,
  upsertUserLlmSettings,
  listUsers,
  upsertReferenceMetadata,
  deleteReferenceMetadata,
  getReferenceMetadata,
  listDifficultyCategories,
  upsertDifficultyCategory,
  deleteDifficultyCategory,
  upsertReminder,
  deleteReminder,
  listReminders,
  createAssistantConversation,
  listAssistantConversations,
  getAssistantConversation,
  updateAssistantConversation,
  addAssistantMessage,
  deleteAssistantConversation,
  getStats,
};
