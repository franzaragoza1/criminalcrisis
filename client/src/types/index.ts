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
  catalog_number?: string;
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
  video_url?: string;
  is_past: number;
  created_at: string;
}

export interface HeroContent {
  image_url?: string;
  tagline: string;
  featured_release_id?: number;
  featured_release?: Release;
}

// --- Promo pool ------------------------------------------------------------

export type ContactStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained';
export type WillPlay = 'yes' | 'maybe' | 'no';

export interface PromoContact {
  id: number;
  email: string;
  name?: string;
  role?: string;
  country?: string;
  company?: string;
  tags: string[];
  status: ContactStatus;
  source?: string;
  notes?: string;
  created_at: string;
}

export interface PromoCampaign {
  id: number;
  title: string;
  slug: string;
  subject?: string;
  body_intro?: string;
  artwork_url?: string;
  release_id?: number;
  status: 'draft' | 'sending' | 'sent';
  embargo_date?: string;
  download_enabled: number;
  created_at: string;
  track_count?: number;
  recipient_count?: number;
  queued_count?: number;
}

/** Shape returned to a recipient by GET /api/promo/:slug?k= */
export interface PromoTrack {
  id: number;
  title: string;
  artist_name?: string;
  duration_seconds?: number;
  stream_url: string | null;
}

export interface PromoFeedbackEntry {
  track_id: number | null;
  rating?: number | null;
  will_play?: WillPlay | null;
  comment?: string | null;
}

export interface PromoView {
  campaign: {
    title: string;
    slug: string;
    body_intro?: string;
    artwork_url?: string;
    embargo_date?: string;
    download_enabled: boolean;
  };
  contactName: string | null;
  tracks: PromoTrack[];
  feedback: PromoFeedbackEntry[];
}

export interface PromoStats {
  campaign: PromoCampaign;
  totals: {
    recipients: number; queued: number; sent: number; delivered: number;
    bounced: number; failed: number; skipped: number;
    visited: number; played: number; downloaded: number; feedback: number;
  };
  recipients: Array<{
    id: number; email: string; name?: string; role?: string; company?: string; country?: string;
    send_status: string; sent_at?: string; delivered_at?: string; first_visit_at?: string;
    error?: string; plays: number; downloads: number; feedback_count: number;
  }>;
  feedback: Array<{
    rating?: number; will_play?: WillPlay; comment?: string; created_at: string;
    name?: string; email: string; company?: string; track_title?: string;
  }>;
  perTrack: Array<{
    id: number; title: string; plays: number; completes: number;
    downloads: number; avg_rating?: string;
  }>;
}
