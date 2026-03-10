import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      bio TEXT,
      photo_url TEXT,
      social_links TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS releases (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      release_date TEXT,
      artwork_url TEXT,
      bandcamp_embed TEXT,
      links TEXT DEFAULT '{}',
      tracklist TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_artists (
      release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE,
      artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
      PRIMARY KEY (release_id, artist_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      venue TEXT,
      city TEXT,
      lineup TEXT DEFAULT '[]',
      ticket_url TEXT,
      image_url TEXT,
      is_past INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hero_content (
      id INTEGER PRIMARY KEY DEFAULT 1,
      image_url TEXT,
      tagline TEXT DEFAULT 'Banging Boogie Bangers',
      featured_release_id INTEGER REFERENCES releases(id)
    )
  `);

  const heroResult = await pool.query('SELECT id FROM hero_content WHERE id = 1');
  if (heroResult.rows.length === 0) {
    await pool.query("INSERT INTO hero_content (id, tagline) VALUES (1, 'Banging Boogie Bangers')");
  }

  const adminResult = await pool.query("SELECT id FROM admin_users WHERE username = 'admin'");
  if (adminResult.rows.length === 0) {
    const hash = await bcrypt.hash('criminal2024', 10);
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('Default admin created: admin / criminal2024');
  }
}
