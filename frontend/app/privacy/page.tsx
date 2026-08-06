import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What data ${SITE_NAME} collects, why, and what control you have over it.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "6 August 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        This explains what {SITE_NAME} collects, why, and what you can do about it. It reflects what
        the software actually does, not a generic template.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — name, university email, password (stored only as a
          hash, never in readable form), and optionally a photo, bio, phone and WhatsApp number.
        </li>
        <li>
          <strong>Student verification</strong> — student ID, registration number, hall, session,
          department and batch, used to confirm you are a JU student.
        </li>
        <li>
          <strong>Your activity</strong> — listings, shops, messages, ratings and reports you create.
        </li>
        <li>
          <strong>Listing views</strong> — so sellers can see how a listing is performing. Views are
          counted once per viewer per day. For signed-out visitors this uses a{" "}
          <strong>salted hash</strong> of IP address and browser, which cannot be reversed to
          identify a person or confirm that a given address viewed a given listing.
        </li>
        <li>
          <strong>Session data</strong> — login tokens, and the IP and browser attached to a session
          so you can spot unfamiliar logins.
        </li>
      </ul>

      <h2>What other people can see</h2>
      <p>
        Your name, photo, bio, department, hall, session, batch, ratings and active listings are
        visible on your public profile. <strong>Your phone and WhatsApp numbers are shown</strong> so
        buyers can contact you — leave them blank if you would rather only be reached through chat.
        Your password is never visible to anyone, including administrators.
      </p>
      <p>
        Reviews you leave are public. Reports you file are visible only to administrators, not to the
        person you reported.
      </p>

      <h2>Why we use it</h2>
      <p>
        To run your account, show your listings to buyers, deliver messages and notifications, count
        views for sellers, keep the marketplace free of scams and abuse, and email you about your
        account (verification, password resets, and messages you missed while offline).
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not run advertising or third-party ad trackers.</li>
        <li>We do not process payments, so we never see your financial details.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies only to keep you signed in and to remember your language and theme. There are
        no analytics or advertising cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account data is kept while your account exists. Deleted listings and shops are retained in a
        deactivated state so that past conversations and ratings still make sense. Login sessions
        expire, and are revoked immediately when you log out.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or remove your bio, photo, phone and WhatsApp number at any time from your profile.</li>
        <li>Delete your listings and shops at any time.</li>
        <li>Ask an administrator to remove your account.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Passwords are hashed, sessions use HTTP-only cookies, and uploads are validated by inspecting
        the actual file contents rather than trusting the filename. No system is perfectly secure —
        use a password you do not reuse elsewhere.
      </p>

      <h2>Contact</h2>
      <p>
        For anything about your data, or to request deletion, use the Report button or contact an
        administrator. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
