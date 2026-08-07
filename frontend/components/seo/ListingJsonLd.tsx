import { SITE_NAME, absoluteUrl } from "@/lib/site";

/** The subset of a listing this needs. Deliberately structural rather than
 *  the full `Listing` type, so the server layout can pass its own fetched
 *  payload without constructing fields the markup never reads. */
export type JsonLdListing = {
  id: string;
  title: string;
  description: string;
  price: string | null;
  price_type: "fixed" | "negotiable" | "free";
  condition?: string | null;
  status: string;
  images: { image_url: string }[];
  shop: { shop_name: string } | null;
  seller: { full_name: string };
  category: { name: string } | null;
  custom_category?: string | null;
};

/**
 * schema.org Product data, which is what lets a listing show up as a rich
 * result (price, availability, image) rather than a plain blue link.
 *
 * Rendered from the *server* layout, not the page: the page is a Client
 * Component that shows a skeleton until its data arrives, so a script tag
 * placed there is absent from the initial HTML — exactly what a crawler
 * reads.
 */
export function ListingJsonLd({ listing }: { listing: JsonLdListing }) {
  const url = absoluteUrl(`/listings/${listing.id}`);
  const seller = listing.shop?.shop_name ?? listing.seller.full_name;

  const availability =
    listing.status === "active"
      ? "https://schema.org/InStock"
      : listing.status === "sold"
        ? "https://schema.org/SoldOut"
        : "https://schema.org/OutOfStock";

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    url,
    image: listing.images.map((i) =>
      i.image_url.startsWith("http") ? i.image_url : absoluteUrl(i.image_url)
    ),
    ...(listing.category
      ? { category: listing.category.name }
      : listing.custom_category
        ? { category: listing.custom_category }
        : {}),
    ...(listing.condition
      ? {
          itemCondition:
            listing.condition === "new"
              ? "https://schema.org/NewCondition"
              : "https://schema.org/UsedCondition",
        }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BDT",
      // Free listings are price 0, not an absent price: Google rejects an
      // Offer with no price, and dropping the whole Offer would lose the
      // availability signal too.
      price: listing.price_type === "free" ? "0" : (listing.price ?? "0"),
      availability,
      seller: { "@type": "Organization", name: seller },
    },
  };

  return (
    <script
      type="application/ld+json"
      // Content is our own API's data, not user-controlled markup, and
      // JSON.stringify escapes it. `<` is escaped anyway to close off the
      // `</script>` injection route.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Site-level identity, emitted once from the home page so search engines
 *  can associate the name and search action with the domain. */
export function SiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/listings?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
