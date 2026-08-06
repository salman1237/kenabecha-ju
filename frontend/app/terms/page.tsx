import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules for buying, selling and running a shop on ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "6 August 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <p>
        {SITE_NAME} is a marketplace run by and for Jahangirnagar University students. By creating an
        account you agree to these terms. If you do not agree, please do not use the service.
      </p>

      <h2>Who can use it</h2>
      <p>
        Accounts are for current JU students. You must register with your university email and give
        accurate details — your name, student ID, registration number, hall and session. Accounts
        that misrepresent who they belong to may be suspended.
      </p>

      <h2>We are not a party to your trades</h2>
      <p>
        <strong>
          {SITE_NAME} does not process payments, hold funds, ship items, or guarantee any listing.
        </strong>{" "}
        Every trade is a private arrangement between a buyer and a seller. We provide the listing and
        the chat; the money and the goods change hands directly between you. That means we cannot
        refund you, reverse a payment, or recover an item on your behalf.
      </p>

      <h2 id="meeting-safely">Meeting safely</h2>
      <ul>
        <li>Meet in busy, public places on campus during daylight where you can.</li>
        <li>Inspect an item fully before paying for it.</li>
        <li>Be wary of anyone who pressures you to pay in advance or to move off-platform.</li>
        <li>Tell someone where you are going for a handover.</li>
      </ul>

      <h2>What you may not list</h2>
      <ul>
        <li>Anything illegal under Bangladeshi law, or banned by university regulations.</li>
        <li>Weapons, drugs, alcohol, tobacco, and prescription medicines.</li>
        <li>Counterfeit goods, stolen property, or pirated material.</li>
        <li>Exam papers, assignments, or any other academic-integrity violation.</li>
        <li>Live animals, adult content, and anything requiring a licence you do not hold.</li>
        <li>Listings you do not own or have no right to sell.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of the text and photos you upload. By posting them you give us permission
        to display them on the site so your listing can be found. You are responsible for making sure
        you have the right to post what you post.
      </p>

      <h2>Conduct</h2>
      <p>
        No harassment, threats, spam, scams, or impersonation. Do not scrape the site or attempt to
        break its security. Report anything that breaks these rules using the Report button on the
        listing, shop or profile in question.
      </p>

      <h2>Moderation</h2>
      <p>
        Administrators may remove a listing or shop, or suspend an account, when these terms are
        broken. Where it is practical we will say why. Listings expire automatically after 30 days
        and can be renewed by their owner.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided as-is. It is a student project and may be unavailable, lose data, or
        change without notice. To the extent the law allows, we are not liable for losses arising
        from your use of it or from any trade you make through it.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Continuing to use the service after a change means you accept the
        updated version.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms, or a report that needs a human: use the Report button, or see
        our <Link href="/privacy">Privacy Policy</Link> for how we handle your data.
      </p>
    </LegalPage>
  );
}
