import { UnsubscribeButton } from "@/components/unsubscribe-button";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="aa-container max-w-md py-16">
      <h1 className="text-3xl mb-2">Unsubscribe</h1>
      <hr className="aa-divider" />
      <UnsubscribeButton token={token} />
    </div>
  );
}
