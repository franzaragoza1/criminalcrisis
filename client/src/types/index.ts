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

export type ContactStatus =
  | 'pending'      // requested access, not yet approved — excluded from all sends
  | 'active'
  | 'rejected'
  | 'unsubscribed'
  | 'bounced'
  | 'complained';

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
  status: 'draft' | 'sending' | 'paused' | 'sent';
  release_date?: string;
  download_enabled: number;
  require_feedback: number;
  created_at: string;
  track_count?: number;
  recipient_count?: number;
  queued_count?: number;
}

export interface DownloadFormat {
  id: 'mp3' | 'wav';
  label: string;
}

/** Shape returned to a recipient by GET /api/promo/:slug?k= */
export interface PromoTrack {
  id: number;
  title: string;
  artist_name?: string;
  duration_seconds?: number;
  stream_url: string | null;
  download_formats: DownloadFormat[];
}

export interface PromoFeedbackEntry {
  track_id: number | null;
  rating?: number | null;
  comment?: string | null;
  favourite_track_id?: number | null;
}

export interface PromoView {
  campaign: {
    title: string;
    slug: string;
    body_intro?: string;
    artwork_url?: string;
    release_date?: string;
    download_enabled: boolean;
    require_feedback: boolean;
  };
  contactName: string | null;
  downloadsUnlocked: boolean;
  tracks: PromoTrack[];
  feedback: PromoFeedbackEntry[];
}

export interface PromoStats {
  campaign: PromoCampaign;
  totals: {
    recipients: number; queued: number; sent: number; delivered: number;
    bounced: number; failed: number; skipped: number;
    visited: number; played: number; downloaded: number; feedback: number;
    /** Got the first mail, never visited, not reminded yet — the reminder's audience. */
    remindable: number; reminderQueued: number; reminderSent: number;
  };
  recipients: Array<{
    id: number; email: string; name?: string; role?: string; company?: string;
    country?: string; source?: string;
    send_status: string; sent_at?: string; delivered_at?: string; first_visit_at?: string;
    reminder_status?: string | null; reminder_sent_at?: string;
    error?: string; plays: number; downloads: number; feedback_count: number;
  }>;
  feedback: Array<{
    rating?: number; comment?: string; created_at: string;
    name?: string; email: string; company?: string; country?: string;
    role?: string; source?: string;
    track_title?: string; favourite_track_title?: string;
  }>;
  perTrack: Array<{
    id: number; title: string; plays: number; completes: number;
    downloads: number; avg_rating?: string;
  }>;
  favourites: Array<{ id: number; title: string; votes: number }>;
}
