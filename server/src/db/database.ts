import pg from 'pg';
import bcrypt from 'bcryptjs';
import { seedArtists, seedReleases, buildBandcampEmbed } from './seedData.js';

const { Pool } = pg;

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
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

  // Safe migrations — add new columns if they don't exist yet
  await pool.query(`ALTER TABLE releases ADD COLUMN IF NOT EXISTS catalog_number TEXT`);
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url TEXT`);

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

  await seedIfEmpty();
}

// Repopulates artists + releases from the Bandcamp discography, but only when the
// releases table is empty (e.g. after the free Render database was recreated).
async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM releases');
  if (rows[0].count > 0) return;

  console.log('Releases table empty — seeding from Bandcamp data...');

  // Artists: insert and map name -> id
  const artistIdByName: Record<string, number> = {};
  for (const a of seedArtists) {
    const slug = slugify(a.name);
    const res = await pool.query(
      `INSERT INTO artists (name, slug, bio, photo_url, social_links)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [a.name, slug, a.bio, a.photo_url, JSON.stringify(a.social_links)]
    );
    artistIdByName[a.name] = res.rows[0].id;
  }

  // Releases + artist links
  let firstReleaseId: number | null = null;
  for (const r of seedReleases) {
    const slug = slugify(r.title);
    const embed = buildBandcampEmbed(r.albumId, r.title, r.artistNames.join(' & '));
    const res = await pool.query(
      `INSERT INTO releases (title, slug, release_date, artwork_url, bandcamp_embed, links, tracklist)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [r.title, slug, r.release_date, r.artwork_url, embed,
       JSON.stringify({ bandcamp: r.url }), JSON.stringify(r.tracklist)]
    );
    if (res.rows.length === 0) continue;
    const releaseId = res.rows[0].id;
    if (firstReleaseId === null) firstReleaseId = releaseId; // newest (seed is date-DESC)

    for (const name of r.artistNames) {
      const artistId = artistIdByName[name];
      if (artistId) {
        await pool.query(
          'INSERT INTO release_artists (release_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [releaseId, artistId]
        );
      }
    }
  }

  // Feature the newest release on the hero section
  if (firstReleaseId !== null) {
    await pool.query('UPDATE hero_content SET featured_release_id = $1 WHERE id = 1', [firstReleaseId]);
  }

  console.log(`Seeded ${seedArtists.length} artists and ${seedReleases.length} releases.`);
}
