import { LegalH, LegalP, LegalList, LegalUpdated, LegalEmail } from "@/components/legal/legal-text";

/** Terms of Service for actavenue.org and for tickets sold through it. */
export function TermsContent() {
  return (
    <>
      <LegalP>
        These terms cover your use of actavenue.org and the tickets you book through it. By booking tickets or using the site, you agree to them. If you do not agree, please do not use the site.
      </LegalP>

      <LegalH>Booking and payment</LegalH>
      <LegalList>
        <li>All prices are in Philippine pesos.</li>
        <li>You book by choosing your tickets, paying by GCash or bank transfer to the account shown for that show, and uploading your payment proof.</li>
        <li>Your seats are held for 24 hours while we check your payment. If we cannot verify it in that time, the hold is released.</li>
        <li>A booking is confirmed only when our team confirms your payment. We email you either way.</li>
        <li>Pay only to the accounts shown on our checkout page. You cover any transfer fees.</li>
      </LegalList>

      <LegalH>Your e-ticket</LegalH>
      <LegalList>
        <li>Each confirmed booking comes with a QR code for the performance you booked.</li>
        <li>Each ticket admits one person, once. Please do not share or post your QR code. Whoever scans it first is admitted.</li>
        <li>If you lose your ticket, find it again under My Tickets or ask us to resend it.</li>
      </LegalList>

      <LegalH>Discounts and promo codes</LegalH>
      <LegalList>
        <li>Only one discount applies to an order. If you qualify for several (a promo code, a group discount or a cross-show discount), we apply the biggest.</li>
        <li>Promo codes may have an end date and a limit on uses.</li>
        <li>Student, PWD and Senior tickets need a valid ID. Bring the same ID to the show. We may refuse entry or cancel a booking if the ID is missing or does not match.</li>
        <li>A cross-show discount needs a valid booking code and its email from a confirmed booking.</li>
        <li>We may cancel a booking that used a discount unfairly.</li>
      </LegalList>

      <LegalH>Changes, cancellations and refunds</LegalH>
      <LegalList>
        <li>All sales are final. We do not refund or exchange tickets because you can no longer attend.</li>
        <li>If we cancel a show, we will offer you a refund or a move to another performance.</li>
        <li>If we reschedule a show, your booking moves to the new date. If you cannot make it, tell us and we will work out a refund or another performance.</li>
        <li>You may ask us to move your booking to another performance of the same show. We do this when seats are available, and it is not guaranteed.</li>
      </LegalList>

      <LegalH>At the show</LegalH>
      <LegalList>
        <li>Please arrive early. Late guests may be seated only at a suitable moment, or may not be admitted.</li>
        <li>Venue rules also apply. Please keep phones silent, and do not film or record the performance unless we say it is allowed.</li>
        <li>We may refuse entry to anyone who disrupts the show or breaks the rules, without a refund.</li>
        <li>Casts, schedules and running times can change.</li>
      </LegalList>

      <LegalH>Accounts and your content</LegalH>
      <LegalList>
        <li>Give us accurate details, and keep your sign in details private. You are responsible for what happens under your account.</li>
        <li>If you add a photo, bio or links to our cast and crew directory, they stay yours. You allow Act Avenue to show them on the site and in our show promotions, and you confirm you have the right to share them.</li>
        <li>We may remove content that is unlawful, harmful or not yours to share.</li>
      </LegalList>

      <LegalH>Fair use of the site</LegalH>
      <LegalP>
        Please do not submit fake payment proof or IDs, use bots or scrapers, try to break into the site, or reserve seats you do not mean to pay for. We may cancel bookings and block access when this happens.
      </LegalP>

      <LegalH>Our content</LegalH>
      <LegalP>
        The site, our name, logo, posters, photos and scripts belong to Act Avenue or the people credited. Please do not copy or reuse them without our written permission.
      </LegalP>

      <LegalH>Our responsibility</LegalH>
      <LegalP>
        We work to keep the site running and accurate, but it is provided as it is, and it may be unavailable at times. We are not responsible for losses caused by events outside our control, such as weather, power or internet outages, or venue closures. Our responsibility for any booking is limited to the amount you paid for it, as far as the law allows. Nothing here limits the rights you have under Philippine consumer law.
      </LegalP>

      <LegalH>Your data</LegalH>
      <LegalP>
        How we handle your personal information is explained in our Data Privacy Notice and Cookie Policy.
      </LegalP>

      <LegalH>Changes to these terms</LegalH>
      <LegalP>
        We may update these terms. The date below shows the latest version. Bookings follow the terms in force when you booked.
      </LegalP>

      <LegalH>Governing law</LegalH>
      <LegalP>These terms follow the laws of the Philippines. Disputes go to the competent courts of the Philippines.</LegalP>

      <LegalH>Contact us</LegalH>
      <LegalP>
        Questions about these terms or a booking? Email <LegalEmail />.
      </LegalP>
      <LegalUpdated />
    </>
  );
}
