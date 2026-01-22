"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { clearToken, hasToken } from "@/lib/auth";

export default function MePage() {
  const router = useRouter();

  // Redirect if no token
  useEffect(() => {
    if (!hasToken()) {
      router.push("/login");
    }
  }, [router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.getMe,
    enabled: hasToken(),
  });

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  if (!hasToken()) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100">
        <div role="alert" className="alert alert-error">
          <span>Failed to load user data. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">MsgBuddy</a>
        </div>
        <div className="flex-none">
          <button onClick={handleLogout} className="btn btn-ghost">
            Logout
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="card w-full max-w-2xl bg-base-200 shadow-xl mx-auto">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-6">Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text font-semibold">Workspace</span>
                </label>
                <div className="text-lg">{data?.workspace.name}</div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Email</span>
                </label>
                <div className="text-lg">{data?.user.email}</div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Role</span>
                </label>
                <div className="text-lg">
                  <span className="badge badge-primary badge-lg">
                    {data?.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-actions justify-end mt-6">
              <button onClick={handleLogout} className="btn btn-error">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
