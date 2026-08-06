import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces. These are already auth-guarded, but crawling them
      // just burns crawl budget on redirects to /login, and /inbox in
      // particular holds private conversations that should never be indexed
      // if an auth check is ever loosened by accident.
      disallow: ["/admin", "/dashboard", "/inbox", "/complete-profile", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
