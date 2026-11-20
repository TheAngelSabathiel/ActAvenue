import { PrivacyContent } from "@/components/legal/privacy-content";

export const metadata = {
  title: "Data Privacy Notice",
  description: "How Act Avenue handles your personal information under the Data Privacy Act of 2012.",
};

export default function Page() {
  return (
    <div className="aa-container max-w-3xl py-16">
      <h1 className="text-4xl mb-2">Data Privacy Notice</h1>
      <hr className="aa-divider" />
      <div className="aa-card p-6 sm:p-8">
        <PrivacyContent />
      </div>
    </div>
  );
}
