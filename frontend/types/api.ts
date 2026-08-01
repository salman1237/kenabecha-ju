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

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string;
  bio: string | null;
  student_id: string;
  registration_no: string;
  hall: Hall;
  department: Department;
  session: string;
  batch: number;
  role: "user" | "admin";
  is_verified: boolean;
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
  listing_count: number;
}

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export interface ListingImage {
  id: string;
  image_url: string;
  sort_order: number;
}

export type PriceType = "fixed" | "negotiable" | "free";
export type Condition = "new" | "used_like_new" | "used_good" | "used_fair";
export type ListingStatus = "active" | "sold" | "out_of_stock" | "removed";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string | null;
  price_type: PriceType;
  condition: Condition;
  quantity: number;
  status: ListingStatus;
  created_at: string;
  seller: { id: string; full_name: string; avatar_url: string | null };
  shop: { id: string; shop_name: string; slug: string; logo_url: string | null } | null;
  images: ListingImage[];
  tags: Tag[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
