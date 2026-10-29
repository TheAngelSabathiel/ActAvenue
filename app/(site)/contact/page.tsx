import { ContactForm } from "@/components/contact-form";

export const metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <div className="aa-container max-w-2xl py-16">
      <h1 className="text-4xl mb-2">Contact us</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-8">Questions about a show, a booking or working with Act Avenue? Send us a message.</p>
      <ContactForm />
    </div>
  );
}
