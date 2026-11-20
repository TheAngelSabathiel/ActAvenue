import { LegalH, LegalP, LegalList, LegalUpdated, LegalEmail } from "@/components/legal/legal-text";

/** Data Privacy Notice, written for the Data Privacy Act of 2012 (Republic Act No. 10173). */
export function PrivacyContent() {
  return (
    <>
      <LegalP>
        Act Avenue respects your privacy and handles your personal information in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
      </LegalP>

      <LegalH>What we collect</LegalH>
      <LegalList>
        <li>Your name, email address and phone number when you book tickets, sign up or send us a message.</li>
        <li>Payment proof (such as a transfer receipt) when you pay for tickets.</li>
        <li>A photo of a valid ID (Student, PWD or Senior) when you buy a discounted ticket that needs one.</li>
        <li>The message you write in our contact form.</li>
        <li>Profile details you choose to add, such as a photo, bio and links, if you join our cast and crew directory.</li>
        <li>The time your ticket was scanned at the door.</li>
        <li>A random visitor code that counts how many people visit our pages and book tickets. It holds no name or email. See the Cookie Policy.</li>
      </LegalList>

      <LegalH>Why we collect it</LegalH>
      <LegalList>
        <li>To process your booking, confirm your payment and send your e-ticket and QR code.</li>
        <li>To check that you qualify for a discounted ticket and admit you at the door.</li>
        <li>To answer your questions and send you important notices about your booking.</li>
        <li>To send news of upcoming Act Avenue shows, only if you chose to receive them.</li>
        <li>To understand how many people visit and book, so we can plan our shows.</li>
        <li>To keep our site secure and prevent misuse.</li>
      </LegalList>

      <LegalH>Who sees it</LegalH>
      <LegalP>
        Only the Act Avenue team and the production staff handling your show can see your booking details. We use trusted service providers to run the site, store data and send email. They process data for us only for these purposes. Your data may be stored on servers outside the Philippines. We do not sell your personal information.
      </LegalP>

      <LegalH>How long we keep it</LegalH>
      <LegalP>
        We keep your information only as long as needed for the purposes above and for any legal, tax or accounting requirement. After that, we delete or anonymize it.
      </LegalP>

      <LegalH>How we protect it</LegalH>
      <LegalP>
        We use access controls, private storage for IDs and payment proof, and secure connections. No system is perfectly secure. If a breach affecting your data occurs, we will notify you and the National Privacy Commission as the law requires.
      </LegalP>

      <LegalH>Your rights</LegalH>
      <LegalP>Under the Data Privacy Act, you have the right to:</LegalP>
      <LegalList>
        <li>be informed about how your data is used;</li>
        <li>access your data and ask for a copy;</li>
        <li>object to processing, or withdraw your consent;</li>
        <li>correct data that is wrong or out of date;</li>
        <li>ask us to suspend, remove or destroy your data;</li>
        <li>move your data to another service in a common format;</li>
        <li>claim damages if you were harmed by misuse of your data; and</li>
        <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
      </LegalList>

      <LegalH>Newsletter</LegalH>
      <LegalP>If you subscribe to show news, every email has an unsubscribe link. You can leave the list at any time.</LegalP>

      <LegalH>Your consent</LegalH>
      <LegalP>
        By ticking the box next to this notice, you confirm that you have read it and you agree to the collection and use of your personal information as described.
      </LegalP>

      <LegalH>Contact us about your data</LegalH>
      <LegalP>
        To use any of your rights or ask a question, email <LegalEmail />.
      </LegalP>
      <LegalUpdated />
    </>
  );
}
