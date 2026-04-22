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

-- Seed and backfill difficulty categories (13 categories from migration plan)
INSERT INTO difficulty_categories (
  id, name, description, observable_characteristics, accommodation_tips, referral_note, has_subcategories
) VALUES
(1, 'Difficulty in Seeing',
 'Learners may have low vision or visual impairment that affects access to printed and visual learning materials.',
 '["Moves close to printed text or board work","Misses visual details in diagrams or charts","Needs high-contrast or enlarged materials"]',
 'Provide high-contrast and enlarged materials, Seat learner near the board and main speaker, Use tactile and verbal descriptions of visual content',
 'Coordinate with SPED coordinator for assistive visual supports.',
 0),
(2, 'Difficulty in Hearing',
 'Learners may have partial or significant hearing loss affecting verbal instruction and class discussion.',
 '["Frequently asks for repetition of spoken directions","Responds better to visual cues than spoken instructions","Misses parts of oral classroom discussion"]',
 'Face the learner while speaking, Pair oral directions with written instructions, Reduce classroom background noise when giving key instructions',
 'Coordinate with hearing support services and family for communication strategies.',
 0),
(3, 'Difficulty in Walking',
 'Learners may experience mobility limitations that affect movement, transitions, and access to learning spaces.',
 '["Needs extra time to move between classroom areas","Avoids tasks requiring frequent movement","Uses mobility aids or needs physical support"]',
 'Keep classroom pathways clear and accessible, Allow extra transition and activity time, Offer seated or low-movement alternatives when needed',
 'Refer for physical therapy or mobility assessment when needed.',
 0),
(4, 'Difficulty in Grasping',
 'Learners may have fine motor challenges that affect writing, holding tools, and manipulation tasks.',
 '["Struggles to hold pencils or scissors steadily","Writes slowly due to hand fatigue","Avoids tasks requiring precise hand movements"]',
 'Provide adaptive grips and larger writing tools, Allow oral or digital alternatives to handwriting, Break fine-motor tasks into short segments',
 'Coordinate occupational therapy support for fine motor interventions.',
 0),
(5, 'Difficulty in Speaking',
 'Learners may have speech production or fluency issues affecting classroom participation.',
 '["Speech may be unclear or fragmented","Hesitates or avoids speaking in group activities","Needs additional time to express ideas verbally"]',
 'Allow additional response time, Accept alternative response formats (written, visual, gestures), Use supportive turn-taking and peer listening routines',
 'Consider speech-language referral for targeted communication support.',
 0),
(6, 'Difficulty in Learning',
 'Learners may need differentiated pacing and scaffolded instruction to master core competencies.',
 '["Needs repeated and simplified instructions","Shows inconsistent performance across similar tasks","Requires guided examples before independent work"]',
 'Use explicit step-by-step modeling, Chunk activities into smaller tasks, Provide guided practice before independent tasks',
 'Coordinate with SPED team for individualized instructional planning.',
 0),
(7, 'Difficulty in Attending/Concentrating',
 'Learners may experience short attention span and distractibility during classroom tasks.',
 '["Loses focus quickly during seatwork","Needs frequent prompts to remain on task","Shifts attention to unrelated classroom stimuli"]',
 'Use short, timed work intervals with breaks, Place learner near low-distraction zones, Give concise instructions and quick check-ins',
 'Monitor behavior trends and refer for focused support when needed.',
 0),
(8, 'Difficulty in Remembering',
 'Learners may have working-memory or recall challenges that affect retention and task completion.',
 '["Forgets multi-step directions after initial instruction","Needs repeated reminders for routines","Has difficulty recalling prior lesson content"]',
 'Use visual schedules and memory cues, Repeat and summarize key points regularly, Provide checklists for multi-step tasks',
 'Consider further assessment for cognitive and memory supports.',
 0),
(9, 'Difficulty in Understanding',
 'Learners may struggle to comprehend abstract, complex, or language-heavy instruction.',
 '["Needs concepts explained in simpler language","Has difficulty answering comprehension questions","Performs better with concrete examples"]',
 'Use concrete examples and visual organizers, Rephrase instructions in simpler language, Check understanding through short formative checks',
 'Coordinate language and learning assessment as needed.',
 0),
(10, 'Difficulty in Behaving',
 'Learners may show behavior regulation challenges that affect classroom participation and safety.',
 '["Displays impulsive or disruptive responses","Finds it difficult to follow classroom routines","Needs frequent redirection for appropriate behavior"]',
 'Set clear routines and behavior expectations, Use consistent positive reinforcement, Apply proactive de-escalation and calm-down strategies',
 'Develop behavior intervention plan with guidance team as needed.',
 0),
(11, 'Emotional/Social Difficulty',
 'Learners may experience emotional regulation or social interaction barriers that affect engagement.',
 '["Appears withdrawn, anxious, or easily upset","Has difficulty initiating or sustaining peer interaction","Shows low confidence during group tasks"]',
 'Build predictable and supportive classroom routines, Use structured cooperative activities with clear roles, Provide regular emotional check-ins and encouragement',
 'Coordinate counseling and family collaboration for sustained support.',
 0),
(12, 'Difficulty in Interacting with Others',
 'Learners may struggle with peer communication, social reciprocity, or collaborative behavior.',
 '["Avoids peer interaction during group work","Misreads social cues and expectations","Needs support resolving social conflicts"]',
 'Teach explicit social scripts and routines, Use guided peer pairing and role assignment, Reinforce respectful communication through modeling',
 'Refer to social skills support programs where available.',
 0),
(13, 'Difficulty in Multiple Areas',
 'Learners present overlapping needs across cognitive, communication, sensory, behavioral, or physical domains.',
 '["Needs support across more than one functional area","Progress varies significantly by task type","Requires coordinated accommodations from multiple strategies"]',
 'Combine accommodations from relevant domains, Use individualized support plans with frequent progress review, Coordinate with multidisciplinary school support team',
 'Prioritize case conferencing and individualized planning.',
 1)
ON CONFLICT(id) DO UPDATE SET
  name = CASE
    WHEN COALESCE(TRIM(difficulty_categories.name), '') = '' THEN excluded.name
    ELSE difficulty_categories.name
  END,
  description = CASE
    WHEN COALESCE(TRIM(difficulty_categories.description), '') = '' THEN excluded.description
    ELSE difficulty_categories.description
  END,
  observable_characteristics = CASE
    WHEN COALESCE(TRIM(difficulty_categories.observable_characteristics), '') = '' THEN excluded.observable_characteristics
    ELSE difficulty_categories.observable_characteristics
  END,
  accommodation_tips = CASE
    WHEN COALESCE(TRIM(difficulty_categories.accommodation_tips), '') = '' THEN excluded.accommodation_tips
    ELSE difficulty_categories.accommodation_tips
  END,
  referral_note = CASE
    WHEN COALESCE(TRIM(difficulty_categories.referral_note), '') = '' THEN excluded.referral_note
    ELSE difficulty_categories.referral_note
  END,
  has_subcategories = CASE
    WHEN difficulty_categories.has_subcategories IS NULL THEN excluded.has_subcategories
    ELSE difficulty_categories.has_subcategories
  END;
