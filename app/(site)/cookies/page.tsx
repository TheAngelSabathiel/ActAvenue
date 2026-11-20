import { CookieContent } from "@/components/legal/cookie-content";

export const metadata = {
  title: "Cookie Policy",
  description: "What actavenue.org keeps in your browser and why.",
};

export default function Page() {
  return (
    <div className="aa-container max-w-3xl py-16">
      <h1 className="text-4xl mb-2">Cookie Policy</h1>
      <hr className="aa-divider" />
      <div className="aa-card p-6 sm:p-8">
        <CookieContent />
      </div>
    </div>
  );
}
