"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestAccountAccessHelpAction } from "@/app/actions/auth";
import { ErrorState } from "@/components/ui/states";
import { BrandLogo } from "@/components/BrandLogo";

export default function AccountAccessPage() {
  const [email, setEmail] = useState("");
  const [alternateContact, setAlternateContact] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestAccountAccessHelpAction({
        email,
        alternateContact,
        message,
      });
      if (!result.success) {
        setError(result.error || "Something went wrong.");
        return;
      }
      setDone(true);
    });
  };

  return (
    <div className="min-h-screen bg-base-100 p-6 grid place-items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center">
          <BrandLogo className="h-7 w-auto" priority />
        </div>
        <div className="space-y-1.5">
          <span className="op-label">Account recovery</span>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.02em]">
            Request account access help
          </h1>
          <p className="text-[0.8125rem] text-base-content/65">
            Can&apos;t receive the reset email? Tell us how else to reach you and
            our team will help you regain access.
          </p>
        </div>

        {done ? (
          <div
            role="status"
            className="rounded-box border-l-2 border border-success/30 border-l-success bg-base-200 px-4 py-3"
          >
            <span className="op-label mb-1 block text-success">request sent</span>
            <p className="text-[0.8125rem] text-base-content">
              Our team has received your request and will reach out using the
              contact you provided. This can take a little while — thanks for
              your patience.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <ErrorState message={error} /> : null}
            <label className="form-control w-full">
              <span className="label-text text-sm">Account email</span>
              <input
                type="email"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="The email you sign in with"
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">
                Alternate contact (email or phone)
              </span>
              <input
                type="text"
                className="input input-bordered w-full"
                value={alternateContact}
                onChange={(e) => setAlternateContact(e.target.value)}
                required
                placeholder="Another way we can reach you"
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">Message (optional)</span>
              <textarea
                className="textarea textarea-bordered w-full"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Briefly describe the problem"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Sending…
                </>
              ) : (
                "Send request"
              )}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link href="/login" className="link link-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
