import { TermsContent } from "@/components/legal/terms-content";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using actavenue.org and booking Act Avenue tickets.",
};

export default function Page() {
  return (
    <div className="aa-container max-w-3xl py-16">
      <h1 className="text-4xl mb-2">Terms of Service</h1>
      <hr className="aa-divider" />
      <div className="aa-card p-6 sm:p-8">
        <TermsContent />
      </div>
    </div>
  );
}
