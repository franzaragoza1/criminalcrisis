import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../criminalcrisis.db');

export const db = new Database(DB_PATH);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      bio TEXT,
      photo_url TEXT,
      social_links TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      release_date TEXT,
      artwork_url TEXT,
      bandcamp_embed TEXT,
      links TEXT DEFAULT '{}',
      tracklist TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS release_artists (
      release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE,
      artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
      PRIMARY KEY (release_id, artist_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      venue TEXT,
      city TEXT,
      lineup TEXT DEFAULT '[]',
      ticket_url TEXT,
      image_url TEXT,
      is_past INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hero_content (
      id INTEGER PRIMARY KEY DEFAULT 1,
      image_url TEXT,
      tagline TEXT DEFAULT 'Banging Boogie Bangers',
      featured_release_id INTEGER REFERENCES releases(id)
    );
  `);

  // Insert default hero content if not exists
  const hero = db.prepare('SELECT id FROM hero_content WHERE id = 1').get();
  if (!hero) {
    db.prepare("INSERT INTO hero_content (id, tagline) VALUES (1, 'Banging Boogie Bangers')").run();
  }

  // Insert default admin user if not exists
  const adminExists = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('criminal2024', 10);
    db.prepare("INSERT INTO admin_users (username, password_hash) VALUES ('admin', ?)").run(hash);
    console.log('Default admin created: admin / criminal2024');
  }
}
