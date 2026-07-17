import { Suspense } from "react";
import ResetPasswordForm from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">Loading...</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
