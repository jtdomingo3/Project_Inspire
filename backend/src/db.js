import { getDatabase } from './database/init.js';
import { promisify } from 'util';

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
    role = 'teacher',
    active = true,
  } = record;

  const now = new Date().toISOString();

  if (id) {
    await pDb.run(
      `UPDATE users SET
        username = ?, password_hash = ?, display_name = ?,
        affiliated_school = ?, role = ?, active = ?, updated_at = ?
      WHERE id = ?`,
      [username, password_hash, display_name, affiliated_school, role, active ? 1 : 0, now, id]
    );
    const result = await pDb.get('SELECT * FROM users WHERE id = ?', [id]);
    return sanitizeUser(result);
  } else {
    await pDb.run(
      `INSERT INTO users (
        username, password_hash, display_name, affiliated_school, role, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password_hash || '', display_name, affiliated_school, role, active ? 1 : 0, now, now]
    );
    const result = await pDb.get('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!result) {
      throw new Error('User not found after upsert');
    }
    return sanitizeUser(result);
  }
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

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    affiliated_school: user.affiliated_school,
    role: user.role,
    active: user.active === 1,
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
  getStats,
};
