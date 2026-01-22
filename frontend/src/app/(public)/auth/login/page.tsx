"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { homeRouteForRole } from "@/lib/roleRoutes";
import axios, { AxiosError } from "axios";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { user } = await login(email, password);
      router.push(homeRouteForRole(user.role));
   } catch (error: unknown) {
     if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<{ error?: string }>;
      setErr(axErr.response?.data?.error ?? "Login failed");
    } else {
     setErr("Login failed");
    }
   } finally {
     setLoading(false);
   }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border p-6 space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>

        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            type="email"
          />
        </div>

       <div className="space-y-2">
         <label className="text-sm">Password</label>

         <div className="flex gap-2">
           <input
              className="w-full rounded-xl border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              type={showPw ? "text" : "password"}
           />

           <button
             type="button"
             onClick={() => setShowPw((v) => !v)}
             className="rounded-xl border px-3 text-sm"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-black text-white py-2 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
