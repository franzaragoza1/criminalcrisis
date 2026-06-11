// Seed data reconstructed from the Criminal Crisis Bandcamp discography.
// Used by seedIfEmpty() in database.ts to repopulate a fresh/empty database.

export interface SeedArtist {
  name: string;
  bio: string | null;
  photo_url: string | null;
  social_links: Record<string, string>;
}

export interface SeedRelease {
  title: string;
  release_date: string; // ISO YYYY-MM-DD
  artwork_url: string;
  albumId: number; // Bandcamp album id, used to build the embed
  url: string; // Bandcamp album page
  artistNames: string[];
  tracklist: Array<{ name: string; id: number }>;
}

export const seedArtists: SeedArtist[] = [
  {
    name: 'frankydrama',
    bio: 'Madrid, Spain.\nmostly making music, sometimes playing tunes.',
    photo_url: 'https://f4.bcbits.com/img/0037962526_23.jpg',
    social_links: { bandcamp: 'https://frankydrama.bandcamp.com' },
  },
  {
    name: 'Joe Koshin',
    bio: 'Bristol, UK.',
    photo_url: 'https://f4.bcbits.com/img/0034119585_23.jpg',
    social_links: { bandcamp: 'https://joekoshin.bandcamp.com' },
  },
  {
    name: 'Roaming Data',
    bio: 'UK.\ncontact/bookings - roamingdatasound@gmail.com',
    photo_url: 'https://f4.bcbits.com/img/0030728684_23.jpg',
    social_links: {
      bandcamp: 'https://roamingdata.bandcamp.com',
      instagram: 'https://instagram.com/_roamingdata',
    },
  },
  {
    name: 'Yosh',
    bio: null,
    photo_url: null,
    social_links: { bandcamp: 'https://criminalcrisis.bandcamp.com' },
  },
];

export const seedReleases: SeedRelease[] = [
  {
    title: 'Unfold',
    release_date: '2025-11-14',
    artwork_url: 'https://f4.bcbits.com/img/a0944459755_5.jpg',
    albumId: 3931919333,
    url: 'https://roamingdata.bandcamp.com/album/unfold-2',
    artistNames: ['Roaming Data'],
    tracklist: [
      { name: 'Unfold', id: 3489821469 },
      { name: 'All I Need', id: 4175026284 },
      { name: 'All I Need (frankydrama remix)', id: 3419370876 },
    ],
  },
  {
    title: 'Strictly Human Pseudo Stories',
    release_date: '2025-08-22',
    artwork_url: 'https://f4.bcbits.com/img/a1620408759_5.jpg',
    albumId: 1341156954,
    url: 'https://frankydrama.bandcamp.com/album/strictly-human-pseudo-stories',
    artistNames: ['frankydrama'],
    tracklist: [
      { name: 'Trigger (Intro)', id: 4127685622 },
      { name: 'Destiny', id: 1175710274 },
      { name: 'Speed', id: 1776065229 },
      { name: 'The Wheel', id: 1017355447 },
      { name: 'You (Interlude)', id: 901756060 },
      { name: 'U.T.U.', id: 202049911 },
      { name: 'Hearts Burning', id: 2826539361 },
      { name: 'A.D.B.Y.', id: 2091542192 },
      { name: 'Upside Down', id: 2088240031 },
      { name: 'Outro (Outro)', id: 1017723954 },
    ],
  },
  {
    title: 'Meat Queue / Further',
    release_date: '2025-05-09',
    artwork_url: 'https://f4.bcbits.com/img/a3293676435_5.jpg',
    albumId: 3235048310,
    url: 'https://joekoshin.bandcamp.com/album/meat-queue-further',
    artistNames: ['Joe Koshin', 'frankydrama'],
    tracklist: [
      { name: 'Joe Koshin - Meat Queue', id: 1461557007 },
      { name: 'frankydrama - Further', id: 3161449937 },
      { name: 'Joe Koshin - Meat Queue (frankydrama Mix)', id: 700057829 },
      { name: "frankydrama - Further (Joe Koshin's Fired Up Remix)", id: 2156112251 },
    ],
  },
  {
    title: 'A Solid Research',
    release_date: '2024-10-31',
    artwork_url: 'https://f4.bcbits.com/img/a1381670994_5.jpg',
    albumId: 4274466473,
    url: 'https://frankydrama.bandcamp.com/album/a-solid-research',
    artistNames: ['frankydrama'],
    tracklist: [
      { name: 'Ritmo Pelotero', id: 2170784224 },
      { name: "You'll Know Me", id: 3815843322 },
      { name: 'Mid-Blurry', id: 1761041446 },
      { name: 'I Was Truly There', id: 3469913617 },
    ],
  },
  {
    title: 'Internal Workings',
    release_date: '2024-08-23',
    artwork_url: 'https://f4.bcbits.com/img/a0882073041_5.jpg',
    albumId: 3805260140,
    url: 'https://joekoshin.bandcamp.com/album/internal-workings',
    artistNames: ['Joe Koshin'],
    tracklist: [
      { name: 'Partition', id: 1761314823 },
      { name: 'Solid', id: 3982994498 },
      { name: 'Ultra', id: 1812191154 },
      { name: 'Partition (Hodge Remix)', id: 2810749556 },
    ],
  },
  {
    title: 'Denial',
    release_date: '2024-06-07',
    artwork_url: 'https://f4.bcbits.com/img/a2261579359_5.jpg',
    albumId: 2540158332,
    url: 'https://frankydrama.bandcamp.com/album/denial',
    artistNames: ['frankydrama'],
    tracklist: [
      { name: 'Denial', id: 1930791132 },
      { name: 'The East & the West', id: 3589753664 },
      { name: "It's O.K.", id: 425879279 },
    ],
  },
  {
    title: 'Danger',
    release_date: '2024-04-05',
    artwork_url: 'https://f4.bcbits.com/img/a1475180251_5.jpg',
    albumId: 3913835713,
    url: 'https://criminalcrisis.bandcamp.com/album/danger',
    artistNames: ['Yosh'],
    tracklist: [
      { name: 'Danger', id: 631785535 },
      { name: 'Slam Dunk', id: 2751592436 },
      { name: 'Danger (frankydrama mix)', id: 4256849821 },
    ],
  },
  {
    title: 'Polka Dot Patterns',
    release_date: '2024-02-02',
    artwork_url: 'https://f4.bcbits.com/img/a3630416387_5.jpg',
    albumId: 291697659,
    url: 'https://frankydrama.bandcamp.com/album/polka-dot-patterns',
    artistNames: ['frankydrama'],
    tracklist: [
      { name: 'Handprint', id: 524429444 },
      { name: 'Ending Edge', id: 139312350 },
      { name: 'Y.E.I.S.', id: 1729596751 },
      { name: 'Shake It', id: 1509859968 },
      { name: 'The Hustle Bullet', id: 149642374 },
    ],
  },
  {
    title: 'Often Mistaken',
    release_date: '2023-11-21',
    artwork_url: 'https://f4.bcbits.com/img/a0393029904_5.jpg',
    albumId: 2574946375,
    url: 'https://criminalcrisis.bandcamp.com/album/often-mistaken',
    artistNames: [],
    tracklist: [
      { name: 'Often Mistaken', id: 4207320848 },
      { name: 'Barking at the Wrong Dream', id: 4029477205 },
      { name: 'Barking at the Wrong Dream (frankydrama mix)', id: 3585231916 },
    ],
  },
  {
    title: 'Criminal Damage',
    release_date: '2023-09-01',
    artwork_url: 'https://f4.bcbits.com/img/a3204958649_5.jpg',
    albumId: 531189357,
    url: 'https://frankydrama.bandcamp.com/album/criminal-damage',
    artistNames: ['frankydrama'],
    tracklist: [
      { name: 'Criminal Damage', id: 3627230184 },
      { name: 'Free Your Mind', id: 755714776 },
      { name: 'Everybody Dance!', id: 3715981812 },
      { name: 'Machete Memorial', id: 1568675589 },
    ],
  },
];

// Builds the Bandcamp iframe embed HTML the player expects (it reads the src album id).
export function buildBandcampEmbed(albumId: number, title: string, artist: string): string {
  return `<iframe style="border: 0; width: 350px; height: 470px;" src="https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/" seamless><a href="">${title} by ${artist}</a></iframe>`;
}
