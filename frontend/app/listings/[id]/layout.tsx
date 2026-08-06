import type { Metadata } from "next";

import { ListingJsonLd, type JsonLdListing } from "@/components/seo/ListingJsonLd";
import { SERVER_API_URL, absoluteUrl } from "@/lib/site";

/**
 * The listing page itself is a Client Component (it needs auth, chat and
 * live state), and Client Components cannot export `generateMetadata`.
 * A thin server layout wraps it so each listing still gets a real title,
 * description and Open Graph image when shared — which is the whole point
 * of link previews on WhatsApp and Facebook, where these get shared.
 */

/** Exactly what the JSON-LD needs, plus nothing extra — metadata reads
 *  the same fields. */
type ListingSeo = JsonLdListing;

async function getListing(id: string): Promise<ListingSeo | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/listings/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as ListingSeo;
  } catch {
    return null;
  }
}

/** Media is proxied same-origin via the /media rewrite, so a stored path
 *  becomes a public absolute URL by prefixing the site origin. */
function imageUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return absoluteUrl(path.startsWith("/") ? path : `/${path}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    // Don't invent a title for something that isn't there, and keep it out
    // of the index — the page will render its own not-found state.
    return { title: "Listing not found", robots: { index: false, follow: false } };
  }

  const seller = listing.shop?.shop_name ?? listing.seller.full_name;
  const price =
    listing.price_type === "free"
      ? "Free"
      : listing.price
        ? `৳${Number(listing.price).toLocaleString("en-US")}`
        : null;

  // Lead with the price: in a marketplace preview it's the thing that decides
  // whether someone taps the link.
  const description = [price, listing.description.replace(/\s+/g, " ").trim()]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);

  const image = imageUrl(listing.images[0]?.image_url);
  const url = absoluteUrl(`/listings/${id}`);

  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    // Sold and expired listings stay reachable by direct link but shouldn't
    // accumulate search traffic for something nobody can buy.
    robots: listing.status === "active" ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: `${listing.title} — ${seller}`,
      description,
      url,
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${listing.title} — ${seller}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Next dedupes identical fetches within a render, so this shares the
  // response generateMetadata already requested rather than hitting the
  // API twice.
  const listing = await getListing(id);

  return (
    <>
      {listing && <ListingJsonLd listing={{ ...listing, id }} />}
      {children}
    </>
  );
}
