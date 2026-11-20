import { LegalH, LegalP, LegalList, LegalUpdated, LegalEmail } from "@/components/legal/legal-text";
import { VisitCountingSwitch } from "@/components/legal/visit-counting";

/** Cookie Policy. Lists everything the site keeps in your browser. */
export function CookieContent() {
  return (
    <>
      <LegalP>
        Cookies are small files a website saves in your browser. Browser storage works the same way. This page lists what actavenue.org keeps in your browser and why. We do not use advertising cookies, social media trackers or third party analytics.
      </LegalP>

      <LegalH>What we use</LegalH>
      <LegalList>
        <li>
          <strong>Cart cookie (cart_session).</strong> Keeps your cart and held seats while you shop. It lasts 7 days and is needed for booking.
        </li>
        <li>
          <strong>Sign in cookies.</strong> Keep you signed in to your account. They are set by our sign in provider, and they end when you sign out or the session expires. They are needed for My Tickets and My Profile.
        </li>
        <li>
          <strong>Visit counting (browser storage).</strong> A random code, with no name or email in it, lets us count how many different people visit a show page and go on to book. It is optional. You can turn it off below. Signed in staff and known bots are not counted.
        </li>
        <li>
          <strong>Staff tools.</strong> The admin pages remember a few settings on the device, such as the last show you scanned. These do not appear for visitors.
        </li>
      </LegalList>

      <LegalH>Your choice</LegalH>
      <LegalP>The cart and sign in cookies are needed to book tickets and sign in. Visit counting is not, so it is yours to switch off.</LegalP>
      <VisitCountingSwitch />
      <LegalP>
        You can also block or delete cookies in your browser settings. If you block the cart or sign in cookies, you will not be able to book tickets or sign in.
      </LegalP>

      <LegalH>Other websites</LegalH>
      <LegalP>
        Links to Facebook, Instagram, TikTok and other sites take you away from ours. Those sites set their own cookies under their own policies.
      </LegalP>

      <LegalH>More about your data</LegalH>
      <LegalP>
        Our Data Privacy Notice explains how we handle your personal information under the Data Privacy Act of 2012. Questions? Email <LegalEmail />.
      </LegalP>
      <LegalUpdated />
    </>
  );
}
