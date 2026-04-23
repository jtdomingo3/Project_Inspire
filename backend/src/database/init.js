import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, '../../..', 'backend/data/inspire.db');

let db = null;

function promisifyDb(database) {
  return {
    run: promisify(database.run.bind(database)),
    get: promisify(database.get.bind(database)),
    all: promisify(database.all.bind(database)),
    exec: promisify(database.exec.bind(database)),
  };
}

export async function initializeDatabase() {
  // Ensure the data directory exists (important for the packaged Electron app)
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      db.run('PRAGMA foreign_keys = ON', async (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err);
          reject(err);
          return;
        }

        try {
          const schemaPath = path.join(__dirname, 'schema.sql');
          const schema = await fs.readFile(schemaPath, 'utf-8');

          db.exec(schema, (err) => {
            if (err) {
              console.error('Error executing schema:', err);
              reject(err);
              return;
            }

            console.log('✓ Database initialized successfully');
            console.log(`  Database location: ${dbPath}`);
            resolve(db);
          });
        } catch (err) {
          console.error('Error reading schema file:', err);
          reject(err);
        }
      });
    });
  });
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function promisifiedDb() {
  return promisifyDb(getDatabase());
}

export async function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Database connection closed');
        db = null;
        resolve();
      }
    });
  });
}

export async function resetDatabase() {
  try {
    const pDb = promisifiedDb();
    const tables = await pDb.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    for (const table of tables) {
      await pDb.run(`DROP TABLE IF EXISTS ${table.name}`);
    }

    const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pDb.exec(schema);

    console.log('✓ Database reset successfully');
  } catch (err) {
    console.error('Error resetting database:', err);
    throw err;
  }
}
