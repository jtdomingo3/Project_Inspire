-- Project INSPIRE SQLite Database Schema
-- Migrated from JSON file storage to relational database

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  affiliated_school TEXT,
  role TEXT DEFAULT 'teacher' CHECK(role IN ('teacher', 'admin', 'researcher')),
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT,
  grade TEXT,
  quarter TEXT,
  title TEXT NOT NULL,
  objectives TEXT,
  difficulty TEXT,
  indicators TEXT,
  support_types TEXT,
  subcategories TEXT,
  custom_support TEXT,
  delivery_mode TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'final', 'example')),
  ai_model_used TEXT,
  reference_docs_used TEXT, -- JSON array stored as string
  generated_output TEXT,
  generated_parsed TEXT, -- JSON stored as string
  lesson_data TEXT, -- JSON stored as string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reflections table
CREATE TABLE IF NOT EXISTS reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT,
  subject TEXT,
  grade TEXT,
  lesson_plan_linked TEXT,
  strategies_used TEXT,
  learner_response TEXT,
  worked_well TEXT,
  needs_improvement TEXT,
  effectiveness_rating INTEGER CHECK(effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  inspire_confidence_rating INTEGER CHECK(inspire_confidence_rating >= 1 AND inspire_confidence_rating <= 5),
  challenges TEXT,
  next_steps TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  observation_date TEXT,
  teacher_observed TEXT,
  subject TEXT,
  focus TEXT,
  phase TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  survey_type TEXT CHECK(survey_type IN ('pre', 'post')),
  example_label TEXT,
  question_responses TEXT, -- JSON object stored as string
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reference Documents table
CREATE TABLE IF NOT EXISTS reference_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT DEFAULT 'References',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Difficulty Categories (static reference data)
CREATE TABLE IF NOT EXISTS difficulty_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  observable_characteristics TEXT, -- JSON stored as string
  accommodation_tips TEXT,
  referral_note TEXT,
  has_subcategories BOOLEAN DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at);
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_observations_user_id ON observations(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Seed difficulty categories (13 categories from migration plan)
INSERT OR IGNORE INTO difficulty_categories (id, name) VALUES
(1, 'Difficulty in Seeing'),
(2, 'Difficulty in Hearing'),
(3, 'Difficulty in Walking'),
(4, 'Difficulty in Grasping'),
(5, 'Difficulty in Speaking'),
(6, 'Difficulty in Learning'),
(7, 'Difficulty in Attending/Concentrating'),
(8, 'Difficulty in Remembering'),
(9, 'Difficulty in Understanding'),
(10, 'Difficulty in Behaving'),
(11, 'Emotional/Social Difficulty'),
(12, 'Difficulty in Interacting with Others'),
(13, 'Difficulty in Multiple Areas');
