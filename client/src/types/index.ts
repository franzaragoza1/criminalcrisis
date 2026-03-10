export interface Artist {
  id: number;
  name: string;
  slug: string;
  bio?: string;
  photo_url?: string;
  social_links: Record<string, string>;
  created_at: string;
}

export interface Release {
  id: number;
  title: string;
  slug: string;
  release_date?: string;
  artwork_url?: string;
  bandcamp_embed?: string;
  links: Record<string, string>;
  tracklist: Array<{ name: string; id: number } | string>;
  artists: Artist[];
  created_at: string;
}

export interface Event {
  id: number;
  name: string;
  event_date: string;
  venue?: string;
  city?: string;
  lineup: string[];
  ticket_url?: string;
  image_url?: string;
  is_past: number;
  created_at: string;
}

export interface HeroContent {
  image_url?: string;
  tagline: string;
  featured_release_id?: number;
  featured_release?: Release;
}
