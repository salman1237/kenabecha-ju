export interface Hall {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  faculty: string;
}

export interface SessionOption {
  session: string;
  batch: number;
}

/** Moderators can act on reports and remove content; only admins can manage
 *  users, grant roles, or edit site content. */
export type UserRole = "user" | "moderator" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  bio: string | null;
  student_id: string | null;
  registration_no: string | null;
  hall: Hall | null;
  department: Department | null;
  session: string | null;
  batch: number | null;
  role: UserRole;
  auth_provider: "local" | "google";
  is_verified: boolean;
  profile_complete: boolean;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  shop_name: string;
  slug: string;
  description: string | null;
  shop_type: string | null;
  logo_url: string | null;
  cover_url: string | null;
  created_at: string;
  is_active: boolean;
  listing_count: number;
  follower_count: number;
  average_rating: number | null;
  rating_count: number;
}

export interface ShopStats {
  active_listings: number;
  sold_count: number;
  followers: number;
  review_count: number;
  average_rating: number | null;
  /** null when the viewer is anonymous — distinct from false (not following). */
  is_following: boolean | null;
  /** Null for anonymous viewers and when nothing is currently rateable. */
  rateable_listing: { id: string; title: string } | null;
}

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface CategoryChild extends CategoryRef {
  listing_count: number;
  is_active: boolean;
}

export interface Category extends CategoryChild {
  children: CategoryChild[];
}

/** The flat shape the admin screen manages. `listing_count` here covers every
 *  listing, not only the browsable ones, because it is what decides whether a
 *  category can safely be deleted. */
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  listing_count: number;
}

export interface ListingImage {
  id: string;
  image_url: string;
  sort_order: number;
}

export type PriceType = "fixed" | "negotiable" | "free";
export type Condition = "new" | "used_like_new" | "used_good" | "used_fair";
export type ListingStatus = "active" | "sold" | "out_of_stock" | "removed" | "expired" | "paused";
export type FulfillmentType = "pickup" | "delivery" | "both";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string | null;
  price_type: PriceType;
  unit: string | null;
  condition: Condition;
  status: ListingStatus;
  // Manual display order within one shop's inventory — meaningless (always
  // its default) for personal listings, which have nothing to reorder
  // against.
  sort_order: number;
  is_top: boolean;
  view_count: number;
  featured_until: string | null;
  expires_at: string | null;
  // Server-computed: whether featured_until is still in the future. Trusting
  // this instead of comparing dates client-side keeps every surface agreeing
  // on the cutoff even when a device clock is wrong.
  is_featured: boolean;
  fulfillment_type: FulfillmentType;
  pickup_address: string | null;
  created_at: string;
  seller: { id: string; full_name: string; avatar_url: string | null; phone: string | null; whatsapp_number: string | null };
  shop: { id: string; shop_name: string; slug: string; logo_url: string | null } | null;
  category: CategoryRef | null;
  // Set instead of category, when the seller picked "Other" and typed a
  // name that isn't in the curated list. Never set alongside category.
  custom_category: string | null;
  images: ListingImage[];
  tags: Tag[];
  // Both default to their "not applicable" value and are only ever actually
  // populated by the endpoints that can afford the extra query — the single
  // listing detail page sets the former, "my listings" sets the latter.
  // null (not false) for a signed-out visitor, so the button can prompt a
  // login rather than render a misleading "not requested" state.
  has_pending_restock_request?: boolean | null;
  restock_request_count?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChatUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ConversationListing {
  id: string;
  title: string;
  price: string | null;
  price_type: PriceType;
  unit: string | null;
  status: ListingStatus;
  image_url: string | null;
}

export interface Conversation {
  id: string;
  listing: ConversationListing;
  shop: { id: string; shop_name: string; slug: string; logo_url: string | null } | null;
  counterparty: ChatUser;
  is_seller: boolean;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Rating {
  id: string;
  listing_id: string;
  stars: number;
  review_text: string | null;
  created_at: string;
  rater: ChatUser;
}

export interface SellerReviews {
  target_type: "shop" | "user";
  target_name: string;
  target_url: string;
  average_rating: number | null;
  rating_count: number;
  /** Star value → count. Always has all five keys, zero-filled. */
  breakdown: Record<string, number>;
  reviews: Rating[];
}

export interface RatingEligibility {
  can_rate: boolean;
  reason: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  student_id: string | null;
  registration_no: string | null;
  hall: Hall | null;
  session: string | null;
  bio: string | null;
  department: Department | null;
  batch: number | null;
  profile_complete: boolean;
  created_at: string;
  average_rating: number | null;
  rating_count: number;
  recent_ratings: Rating[];
  shops: Shop[];
}

export interface DashboardStats {
  active_listings: number;
  sold_listings: number;
  shops: number;
  unread_messages: number;
  conversations: number;
  saved_count: number;
  average_rating: number | null;
  rating_count: number;
}

export interface ActivityPoint {
  date: string;
  count: number;
}

export interface PublicStats {
  total_users: number;
  total_shops: number;
  total_active_listings: number;
  total_ratings: number;
}

export interface PublicReview {
  id: string;
  stars: number;
  review_text: string;
  created_at: string;
  rater: { id: string; full_name: string; avatar_url: string | null };
  target_name: string;
  target_url: string;
  listing_title: string;
}

export type ReportTargetType = "listing" | "shop" | "user";
export type ReportReason =
  | "spam"
  | "scam_fraud"
  | "inappropriate_content"
  | "counterfeit"
  | "harassment"
  | "other";
export type ReportStatus =
  | "pending"
  | "resolved_dismissed"
  | "resolved_removed"
  | "resolved_warned"
  | "resolved_banned";

export interface Report {
  id: string;
  reporter: ChatUser;
  target_type: ReportTargetType;
  target_id: string;
  target_label: string;
  reason_code: ReportReason;
  note: string | null;
  status: ReportStatus;
  resolved_by: ChatUser | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_shops: number;
  total_active_listings: number;
  total_messages: number;
  pending_reports: number;
}

export type NotificationType =
  | "new_message"
  | "new_rating"
  | "listing_reported"
  | "listing_removed"
  | "shop_reported"
  | "shop_removed";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread_count: number;
}



export interface AuditLogEntry {
  id: string;
  /** Snapshotted when written, so the entry still names the actor after the
   *  account is renamed or deleted. */
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}


export type SectionType =
  | "hero"
  | "stats"
  | "top_products"
  | "latest_listings"
  | "featured_shops"
  | "categories"
  | "how_it_works"
  | "reviews"
  | "cta"
  | "newsletter";

export interface PageSection {
  id: string;
  key: string;
  section_type: SectionType;
  sort_order: number;
  is_active: boolean;
  /** Per-locale copy overrides and per-type options. Empty means "use the
   *  bundled defaults". */
  settings: Record<string, unknown>;
  updated_at: string;
}


export type NavLocation = "navbar" | "footer";
export type NavVisibility = "always" | "signed_in" | "signed_out";

export interface NavLink {
  id: string;
  /** The bundled translation to fall back to; null for admin-created links. */
  translation_key: string | null;
  /** Per-locale override, e.g. {"en": "...", "bn": "..."}. */
  label: Record<string, unknown>;
  href: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  visibility: NavVisibility;
}

export interface NavMenu {
  id: string;
  key: string;
  location: NavLocation;
  translation_key: string | null;
  label: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  links: NavLink[];
}

/** Admin-editable branding/contact — logo, contact email, WhatsApp, social
 *  links. Every field is nullable/empty by default, so an unconfigured site
 *  still renders the hard-coded fallbacks in Navbar/Footer. */
export interface SiteInfo {
  logo_url: string | null;
  contact_email: string | null;
  whatsapp_number: string | null;
  social_links: Record<string, string>;
}

export interface Navigation {
  menus: NavMenu[];
  navbar_controls: Record<string, boolean>;
  /** The site-wide banner, when one is live. Null is the normal case. */
  announcement?: Announcement | null;
  site_info: SiteInfo;
}


export interface DailyPoint {
  date: string;
  signups: number;
  listings: number;
  messages: number;
}

export interface TopListing {
  id: string;
  title: string;
  view_count: number;
}

/** Each headline count paired with how many arrived inside the window. */
export interface DashboardTotals {
  total_users: number;
  new_users: number;
  total_shops: number;
  new_shops: number;
  total_active_listings: number;
  new_listings: number;
  total_messages: number;
  new_messages: number;
  pending_reports: number;
}

export interface AdminDashboard {
  days: number;
  totals: DashboardTotals;
  series: DailyPoint[];
  top_listings: TopListing[];
}

/** Per-item outcome: items are independent, so a partial run is reported
 *  rather than hidden behind a single error. */
export interface BulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

export type AnnouncementVariant = "info" | "warning" | "critical";

export interface Announcement {
  message: Record<string, unknown>;
  variant: AnnouncementVariant;
  dismissible: boolean;
  /** Bumped when the wording changes, so a dismissal applies to one
   *  announcement rather than silencing every future one. */
  version: number;
}

export interface AdminAnnouncement extends Announcement {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}
