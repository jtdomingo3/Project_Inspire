import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { initializeDatabase, closeDatabase } from './database/init.js';
import * as db from './db.js';
import { hashPassword } from './utils/password.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateJsonToSqlite() {
  console.log('🔄 Starting migration from JSON to SQLite...\n');

  try {
    // 1. Initialize database
    console.log('📦 Initializing SQLite database...');
    await initializeDatabase();
    console.log('   ✓ Database initialized\n');

    // 2. Read JSON file
    console.log('📂 Reading data from store.json...');
    const storeJsonPath = path.join(__dirname, '../data/store.json');
    const storeData = JSON.parse(await fs.readFile(storeJsonPath, 'utf-8'));
    console.log('   ✓ Data loaded\n');

    // 3. Migrate Users
    console.log('👥 Migrating users...');
    let userCount = 0;
    if (storeData.users && Array.isArray(storeData.users)) {
      for (const user of storeData.users) {
        // Hash password for existing users
        const passwordHash = await hashPassword(user.password || 'password123');

        await db.upsertUser({
          username: user.username?.toLowerCase() || `user-${Date.now()}`,
          password_hash: passwordHash,
          display_name: user.display_name || 'User',
          affiliated_school: user.affiliated_school || '',
          role: user.role || 'teacher',
          active: user.active !== false,
        });
        userCount++;
      }
    } else {
      // Create default admin user
      const adminHash = await hashPassword('admin123');
      await db.upsertUser({
        username: 'admin',
        password_hash: adminHash,
        display_name: 'Admin',
        affiliated_school: '',
        role: 'admin',
        active: true,
      });
      userCount++;
    }
    console.log(`   ✓ Migrated ${userCount} users\n`);

    // 4. Migrate Lessons
    console.log('📚 Migrating lessons...');
    let lessonCount = 0;
    if (storeData.lessons && Array.isArray(storeData.lessons)) {
      for (const lesson of storeData.lessons) {
        try {
          await db.upsertLesson({
            user_id: 1, // Map to first user
            subject: lesson.subject,
            grade: lesson.grade,
            quarter: lesson.quarter,
            title: lesson.title || 'Untitled Lesson',
            objectives: lesson.objectives,
            difficulty: lesson.difficulty,
            indicators: lesson.indicators,
            support_types: lesson.support_types,
            subcategories: lesson.subcategories || '',
            custom_support: lesson.custom_support || '',
            delivery_mode: lesson.delivery_mode,
            status: lesson.status || 'draft',
            ai_model_used: lesson.ai_model_used,
            reference_docs_used: lesson.reference_docs_used || [],
            generated_output: lesson.generated_output || '',
            generated_parsed: lesson.generated_parsed,
            lesson_data: lesson.lesson_data,
            created_at: lesson.created_at,
            updated_at: lesson.updated_at,
          });
          lessonCount++;
        } catch (err) {
          console.warn(`   ⚠ Failed to migrate lesson "${lesson.title}":`, (err as Error).message);
        }
      }
    }
    console.log(`   ✓ Migrated ${lessonCount} lessons\n`);

    // 5. Migrate Reflections
    console.log('💭 Migrating reflections...');
    let reflectionCount = 0;
    if (storeData.reflections && Array.isArray(storeData.reflections)) {
      for (const reflection of storeData.reflections) {
        try {
          await db.upsertReflection({
            user_id: 1, // Map to first user
            date: reflection.date,
            subject: reflection.subject,
            grade: reflection.grade,
            lesson_plan_linked: reflection.lesson_plan_linked || '',
            strategies_used: reflection.strategies_used,
            learner_response: reflection.learner_response,
            worked_well: reflection.worked_well || '',
            needs_improvement: reflection.needs_improvement || '',
            effectiveness_rating: reflection.effectiveness_rating,
            inspire_confidence_rating: reflection.inspire_confidence_rating,
            challenges: reflection.challenges,
            next_steps: reflection.next_steps,
            created_at: reflection.created_at,
            updated_at: reflection.updated_at,
          });
          reflectionCount++;
        } catch (err) {
          console.warn(`   ⚠ Failed to migrate reflection:`, (err as Error).message);
        }
      }
    }
    console.log(`   ✓ Migrated ${reflectionCount} reflections\n`);

    // 6. Migrate Observations
    console.log('👁️  Migrating observations...');
    let observationCount = 0;
    if (storeData.observations && Array.isArray(storeData.observations)) {
      for (const observation of storeData.observations) {
        try {
          await db.upsertObservation({
            user_id: 1, // Map to first user
            observation_date: observation.observation_date,
            teacher_observed: observation.teacher_observed,
            subject: observation.subject,
            focus: observation.focus,
            phase: observation.phase,
            rating: observation.rating,
            notes: observation.notes,
            created_at: observation.created_at,
          });
          observationCount++;
        } catch (err) {
          console.warn(`   ⚠ Failed to migrate observation:`, (err as Error).message);
        }
      }
    }
    console.log(`   ✓ Migrated ${observationCount} observations\n`);

    // 7. Migrate Surveys
    console.log('📊 Migrating surveys...');
    let surveyCount = 0;
    if (storeData.surveys && Array.isArray(storeData.surveys)) {
      for (const survey of storeData.surveys) {
        try {
          await db.upsertSurvey({
            user_id: 1, // Map to first user
            survey_type: survey.survey_type,
            example_label: survey.example_label || '',
            question_responses: survey.question_responses || {},
            completed_at: survey.completed_at,
          });
          surveyCount++;
        } catch (err) {
          console.warn(`   ⚠ Failed to migrate survey:`, (err as Error).message);
        }
      }
    }
    console.log(`   ✓ Migrated ${surveyCount} surveys\n`);

    // 8. Migrate Reference Metadata
    console.log('📄 Migrating reference metadata...');
    let refCount = 0;
    if (storeData.reference_metadata && typeof storeData.reference_metadata === 'object') {
      for (const [fileName, metadata] of Object.entries(storeData.reference_metadata)) {
        try {
          await db.upsertReferenceMetadata(fileName, metadata);
          refCount++;
        } catch (err) {
          console.warn(`   ⚠ Failed to migrate reference "${fileName}":`, (err as Error).message);
        }
      }
    }
    console.log(`   ✓ Migrated ${refCount} reference documents\n`);

    // 9. Summary
    console.log('✅ Migration Summary:');
    console.log(`   • Users: ${userCount}`);
    console.log(`   • Lessons: ${lessonCount}`);
    console.log(`   • Reflections: ${reflectionCount}`);
    console.log(`   • Observations: ${observationCount}`);
    console.log(`   • Surveys: ${surveyCount}`);
    console.log(`   • Reference Documents: ${refCount}`);
    console.log('\n✨ Migration completed successfully!\n');

    // Close database
    await closeDatabase();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

// Run migration
migrateJsonToSqlite();
