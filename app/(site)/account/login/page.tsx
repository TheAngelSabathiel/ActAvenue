import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";

export default function LoginPage() {
  return (
    <div className="aa-container max-w-sm py-16">
      <h1 className="text-3xl mb-2">Sign In</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-6">An account is optional. It keeps your ticket history in one place.</p>
      <LoginForm
        redirectTo="/account"
        footer={
          <p className="text-sm text-muted mt-6">
            No account yet?{" "}
            <Link href="/account/signup" className="text-black font-bold underline">Create one</Link>
            {" or "}
            <Link href="/cart" className="text-black font-bold underline">continue as guest</Link>
          </p>
        }
      />
    </div>
  );
}
