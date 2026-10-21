import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-forms";

export default function SignupPage() {
  return (
    <div className="aa-container max-w-sm py-16">
      <h1 className="text-3xl mb-2">Create Account</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-6">Optional. You can also check out as a guest.</p>
      <SignupForm
        redirectTo="/account"
        footer={
          <p className="text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link href="/account/login" className="text-black font-bold underline">Sign in</Link>
          </p>
        }
      />
    </div>
  );
}
