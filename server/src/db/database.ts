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

  // ---------------------------------------------------------------------------
  // Promo pool
  // ---------------------------------------------------------------------------

  // The press/DJ mailing list. `status` doubles as the suppression list: anything
  // other than 'active' is excluded from every send.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_contacts (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'dj',
      country TEXT,
      company TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      source TEXT DEFAULT 'manual',
      unsub_token TEXT UNIQUE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_campaigns (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      subject TEXT,
      body_intro TEXT,
      artwork_url TEXT,
      release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft',
      release_date TEXT,
      download_enabled INTEGER DEFAULT 1,
      require_feedback INTEGER DEFAULT 1,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_tracks (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES promo_campaigns(id) ON DELETE CASCADE,
      position INTEGER DEFAULT 0,
      title TEXT NOT NULL,
      artist_name TEXT,
      stream_public_id TEXT,
      -- The master as uploaded (WAV/AIFF/320). download_format records its real
      -- extension so we know whether a separate lossless download is on offer.
      download_public_id TEXT,
      download_format TEXT,
      -- Optional hand-encoded 320 MP3. When null, the 320 is derived from the
      -- master on delivery.
      mp3_public_id TEXT,
      duration_seconds INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // One row per (campaign, contact). `access_token` is the per-person secret in
  // the magic link — it is what makes every play/download attributable.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_recipients (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES promo_campaigns(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES promo_contacts(id) ON DELETE CASCADE,
      access_token TEXT UNIQUE NOT NULL,
      send_status TEXT DEFAULT 'queued',
      provider_message_id TEXT,
      error TEXT,
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      first_visit_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (campaign_id, contact_id)
    )
  `);

  // Append-only activity log: visit | play | play_75 | complete | download | click
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_events (
      id SERIAL PRIMARY KEY,
      recipient_id INTEGER REFERENCES promo_recipients(id) ON DELETE CASCADE,
      track_id INTEGER REFERENCES promo_tracks(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      meta TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // track_id NULL = feedback about the release as a whole
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_feedback (
      id SERIAL PRIMARY KEY,
      recipient_id INTEGER REFERENCES promo_recipients(id) ON DELETE CASCADE,
      track_id INTEGER REFERENCES promo_tracks(id) ON DELETE CASCADE,
      rating INTEGER,
      will_play TEXT,
      comment TEXT,
      -- Only meaningful on the overall row (track_id IS NULL): which track the
      -- recipient rated highest. Nulled rather than cascaded so deleting a track
      -- doesn't wipe someone's whole feedback entry.
      favourite_track_id INTEGER REFERENCES promo_tracks(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Postgres treats NULLs as distinct in a UNIQUE constraint, so the overall
  // feedback row (track_id IS NULL) needs its own partial index to stay upsertable.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS promo_feedback_track_uniq
      ON promo_feedback (recipient_id, track_id) WHERE track_id IS NOT NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS promo_feedback_overall_uniq
      ON promo_feedback (recipient_id) WHERE track_id IS NULL
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS promo_events_recipient_idx ON promo_events (recipient_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS promo_recipients_queue_idx ON promo_recipients (send_status, campaign_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS promo_contacts_status_idx ON promo_contacts (status)`);

  // Safe migrations — add new columns if they don't exist yet
  await pool.query(`ALTER TABLE releases ADD COLUMN IF NOT EXISTS catalog_number TEXT`);
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url TEXT`);
  await pool.query(`ALTER TABLE promo_tracks ADD COLUMN IF NOT EXISTS mp3_public_id TEXT`);
  await pool.query(`ALTER TABLE promo_campaigns ADD COLUMN IF NOT EXISTS require_feedback INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE promo_feedback ADD COLUMN IF NOT EXISTS favourite_track_id INTEGER REFERENCES promo_tracks(id) ON DELETE SET NULL`);

  // Reminders are a second queue over the same rows, kept in their own columns
  // so queueing one never disturbs the record of the first send: send_status
  // stays 'sent'/'delivered' and sent_at keeps pointing at the original.
  // NULL reminder_status = never reminded.
  // Public share link. One unguessable token per campaign, not the bare slug:
  // slugs are short and predictable, and a draft or paused campaign must not
  // become readable by anyone who guesses one. Nullable = no link handed out.
  await pool.query(`ALTER TABLE promo_campaigns ADD COLUMN IF NOT EXISTS share_token TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS promo_campaigns_share_token_uniq
                      ON promo_campaigns (share_token) WHERE share_token IS NOT NULL`);

  await pool.query(`ALTER TABLE promo_recipients ADD COLUMN IF NOT EXISTS reminder_status TEXT`);
  await pool.query(`ALTER TABLE promo_recipients ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE promo_recipients ADD COLUMN IF NOT EXISTS reminder_message_id TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS promo_recipients_reminder_idx ON promo_recipients (reminder_status, campaign_id)`);

  // "Embargo" is press language; for a club label the useful date is when the
  // record is out. Postgres has no IF EXISTS for RENAME COLUMN, hence the guard.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='promo_campaigns' AND column_name='embargo_date')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='promo_campaigns' AND column_name='release_date') THEN
        ALTER TABLE promo_campaigns RENAME COLUMN embargo_date TO release_date;
      END IF;
    END $$;
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
