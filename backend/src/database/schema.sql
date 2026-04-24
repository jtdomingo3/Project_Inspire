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
  designation TEXT,
  employee_id TEXT,
  supervisor TEXT,
  principal TEXT,
  subject_area TEXT,
  grade_level_handled TEXT,
  years_experience INTEGER DEFAULT 0,
  special_education_training BOOLEAN DEFAULT 0,
  research_consent BOOLEAN DEFAULT 0,
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
DROP TABLE IF EXISTS difficulty_categories;
CREATE TABLE IF NOT EXISTS difficulty_categories (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  observable_characteristics TEXT, -- JSON array
  subcategories TEXT,              -- JSON array of strings
  accommodation_tips TEXT,
  referral_note TEXT,
  has_subcategories BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at);
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_observations_user_id ON observations(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


-- Seed and backfill difficulty categories (13 categories from prototype)
INSERT INTO difficulty_categories (
  id, name, description, observable_characteristics, subcategories, accommodation_tips, referral_note, has_subcategories
) VALUES
(1, 'Difficulty in Displaying Interpersonal Behaviors',
 'Challenges in forming and maintaining positive relationships with peers and adults.',
 '["Avoids group work or isolates self during activities","Frequent conflicts or misunderstandings with classmates","Difficulty taking turns or sharing materials","Limited eye contact or flat affect when interacting","Overly dependent on teacher prompts to interact","May misinterpret social cues and jokes"]',
 '[]',
 'Use structured cooperative learning roles (leader, recorder, reporter)., Model and role-play expected social behaviors., Provide clear, visual rules for group work., Offer positive reinforcement for successful peer interactions.',
 'Consult the school guidance counselor if interpersonal difficulties are persistent and cause significant distress.',
 0),
(2, 'Difficulty in Basic Learning and Applying Knowledge',
 'Difficulties in acquiring and applying academic concepts such as reading, writing, or mathematics.',
 '["Difficulty learning connections between letters and sounds","Confuses small words (e.g., \"at\" and \"to\")","Letter reversals (e.g., d for b)","Word reversals (e.g., \"tip\" for \"pit\")","Avoids reading aloud","Trouble following oral instructions","Poor spelling despite effort","Appears restless or easily distracted during reading"]',
 '["Dyslexia (Reading)","Dysgraphia (Writing)","Dyscalculia (Calculating)","Spelling Difficulty"]',
 'Provide multi-sensory instruction combining visual, auditory, and kinesthetic cues., Break tasks into smaller, manageable steps., Allow alternative ways to demonstrate learning (oral, project-based)., Use frequent, low-stakes formative assessment.',
 'Consider referral for psychoeducational assessment when persistent academic difficulties are observed across subjects.',
 1),
(3, 'Difficulty in Communication',
 'Challenges in understanding or producing spoken language.',
 '["Delayed response when questions are asked","Limited vocabulary compared to peers","Difficulty organizing thoughts into sentences","Speech that is hard to understand","Frustration when asked to explain ideas","Reliance on gestures instead of words"]',
 '["Speech Sound Errors","Articulation Disorders","Phonological Disorder","Fluency Disorder — Stuttering","Fluency Disorder — Cluttering"]',
 'Allow extra time to respond to questions., Use visual supports, pictures, and gestures., Model expanded sentences based on learner responses., Avoid interrupting; acknowledge all communication attempts.',
 'Coordinate with a speech-language pathologist for ongoing communication concerns.',
 1),
(4, 'Difficulty in Mobility',
 'Learners may experience mobility limitations that affect movement, transitions, and access to learning spaces.',
 '["Needs extra time to move between classroom areas","Avoids tasks requiring frequent movement","Uses mobility aids or needs physical support"]',
 '[]',
 'Keep classroom pathways clear and accessible, Allow extra transition and activity time, Offer seated or low-movement alternatives when needed',
 'Refer for physical therapy or mobility assessment when needed.',
 0),
(5, 'Difficulty in Hearing',
 'Learners may have partial or significant hearing loss affecting verbal instruction and class discussion.',
 '["Frequently asks for repetition of spoken directions","Responds better to visual cues than spoken instructions","Misses parts of oral classroom discussion"]',
 '[]',
 'Face the learner while speaking, Pair oral directions with written instructions, Reduce classroom background noise when giving key instructions',
 'Coordinate with hearing support services and family for communication strategies.',
 0),
(6, 'Difficulty in Seeing',
 'Learners may have low vision or visual impairment that affects access to printed and visual learning materials.',
 '["Moves close to printed text or board work","Misses visual details in diagrams or charts","Needs high-contrast or enlarged materials"]',
 '[]',
 'Provide high-contrast and enlarged materials, Seat learner near the board and main speaker, Use tactile and verbal descriptions of visual content',
 'Coordinate with SPED coordinator for assistive visual supports.',
 0),
(7, 'Difficulty in Remembering / Concentrating',
 'Learners may experience short attention span, distractibility, or working-memory challenges.',
 '["Loses focus quickly during seatwork","Needs frequent prompts to remain on task","Shifts attention to unrelated classroom stimuli","Forgets multi-step directions","Needs repeated reminders for routines"]',
 '["Physical and Motor Domain","Personal and Social Domain","Learning / Cognitive Domain","Spoken Language Domain"]',
 'Use short, timed work intervals with breaks, Place learner near low-distraction zones, Give concise instructions and quick check-ins, Use visual schedules and memory cues',
 'Monitor behavior trends and refer for focused support when needed.',
 1),
(8, 'Difficulty in Performing Adaptive Skills',
 'Challenges in performing daily self-care, safety, and social tasks appropriate for age.',
 '["Struggles with basic self-care routines","Difficulty following safety rules in the classroom","Needs significant support for age-appropriate independence"]',
 '[]',
 'Break life skills into small, teachable steps., Use visual checklists for routines., Provide consistent, immediate feedback., Practice skills in the natural environment.',
 'Coordinate with occupational therapists and families for functional goal setting.',
 0),
(9, 'Difficulty in Seeing and Hearing (Deaf-Blindness)',
 'Combined vision and hearing loss that significantly limits communication and access to information.',
 '["Limited response to both visual and auditory stimuli","Relies heavily on touch for exploration","Needs specialized communication support (e.g., tactile signing)"]',
 '[]',
 'Use consistent tactile cues and routines., Provide a dedicated intervener or support person., Adapt materials for tactile exploration., Ensure a stable and predictable environment.',
 'Requires highly specialized multidisciplinary support and assistive technology.',
 0),
(10, 'Difficulty in Hearing with Other Disabilities',
 'Hearing loss accompanied by other cognitive, physical, or sensory challenges.',
 '["Multiple barriers to communication and learning","Complex support needs requiring tiered interventions"]',
 '[]',
 'Combine auditory supports with other specialized accommodations., Use a total communication approach., Coordinate between multiple support specialists.',
 'Requires integrated case management and comprehensive support planning.',
 0),
(11, 'Difficulty in Communicating — ADHD',
 'Difficulties with attention, impulse control, and/or hyperactivity associated with ADHD.',
 '["Easily distracted by sounds, lights, or movement","Does not seem to listen when spoken to","Difficulty following multi-step directions","Frequently loses materials","Fails to finish schoolwork","Appears confused or overwhelmed","Poor study skills / weak executive function"]',
 '["Inattention","Hyperactivity","Impulsivity"]',
 'Seat the learner away from high-traffic and noisy areas., Provide clear, concise instructions one step at a time., Use timers and visual schedules to structure tasks., Offer movement breaks and hands-on learning opportunities.',
 'Collaborate with parents, school health personnel, and specialists for comprehensive ADHD assessment.',
 1),
(12, 'Difficulty in Communicating — Autism',
 'Challenges with social interaction, restricted interests, and repetitive behaviors.',
 '["Difficulty with social-emotional reciprocity","Limited non-verbal communicative behaviors","Fixated interests or repetitive motor movements","Insistence on sameness and routines"]',
 '[]',
 'Use visual schedules and predictable routines., Provide clear, literal instructions., Offer a quiet "calm-down" space., Support social interactions with explicit scripts.',
 'Coordinate with behavior specialists and speech therapists for social-communication support.',
 0),
(13, 'Difficulty in Communicating — Tourette Syndrome',
 'Presence of multiple motor tics and one or more vocal tics.',
 '["Involuntary, rapid, recurrent motor movements","Involuntary vocalizations","Tics may increase during stress or excitement"]',
 '[]',
 'Allow for "tic breaks" in a private space., Provide extra time for tasks affected by tics., Educate peers to reduce stigma., Focus on task completion rather than fine motor precision.',
 'Collaborate with health professionals to manage classroom triggers and stress.',
 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  observable_characteristics = excluded.observable_characteristics,
  subcategories = excluded.subcategories,
  accommodation_tips = excluded.accommodation_tips,
  referral_note = excluded.referral_note,
  has_subcategories = excluded.has_subcategories;

-- Seed canonical reference document metadata
INSERT INTO reference_documents (filename, title, description, category) VALUES
('assessment-checklist.docx', 'Learner Difficulty Assessment Checklist', 'Comprehensive checklist of learner difficulty categories, indicators, and classroom support strategies.', 'Tips'),
('DO_s2020_021-transition.pdf', 'DO s.2020 No.021 - Transition Program Guidance', 'Guidance for transition planning and learner progression across educational stages.', 'Strategies'),
('DO_s2021_044.pdf', 'DO s.2021 No.044 - Inclusive Education Policy Framework', 'Official policy guidance for implementing inclusive education principles and learner support.', 'References'),
('DSM-5.pdf', 'DSM-5 Reference for Learning and Behavior Needs', 'Diagnostic reference to support interpretation of learner characteristics and intervention planning.', 'References'),
('LEGAL BASIS.docx', 'Legal Basis for Inclusive Education', 'Policy and legal foundations supporting inclusive education implementation in schools.', 'References'),
('QUINONES_JANICE_ACTION RESEARCH_PROPOSAL.pdf', 'Action Research Proposal for Inclusive Teaching', 'School-based action research document focused on inclusive teaching practices and outcomes.', 'References'),
('REVISED K TO 12 DLP.docx', 'Revised K to 12 Daily Lesson Plan Guide', 'Template and guide for writing standards-aligned daily lesson plans in the K to 12 curriculum.', 'Templates')
ON CONFLICT(filename) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  updated_at = CURRENT_TIMESTAMP;

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  due_date TEXT,
  is_completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);

-- Assistant conversations table
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  last_model TEXT,
  reference_docs TEXT, -- JSON array stored as string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Assistant messages table
CREATE TABLE IF NOT EXISTS assistant_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('assistant', 'user')),
  content TEXT NOT NULL,
  sources TEXT, -- JSON array stored as string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated_at ON assistant_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);

-- Seed default admin account (Password: admin123)
INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role)
VALUES (1, 'admin', '$2b$10$XyGuqkMT0lZif26sMcW2lO2xMkE/WSrEJnGDuNTcSQT0a/TnUOx1y', 'System Administrator', 'admin');
