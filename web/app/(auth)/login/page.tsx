"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { login, fetchMe } from "@/lib/api/endpoints";
import { apiErrorMessage } from "@/lib/api/axios";
import { useAuthStore, useAuthHydrated } from "@/lib/store/authStore";
import { COLORS } from "@/lib/theme";

const SEED_USERS = [
  { email: "ritik@curlohair.com", role: "Founder · Assigner" },
  { email: "tanishk@curlohair.com", role: "Sr Manager · Assigner" },
  { email: "prakash@curlohair.com", role: "Consultant · Assigner" },
  { email: "anmol@curlohair.com", role: "Web Lead · Assignee" },
  { email: "pushpendra@curlohair.com", role: "Ads Lead · Assignee" },
  { email: "kunal@curlohair.com", role: "Design · Assignee" },
  { email: "saksham@curlohair.com", role: "Marketplaces · Assignee" },
  { email: "suraj@curlohair.com", role: "Web Exec · Assignee" },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthHydrated();

  const [email, setEmail] = useState("ritik@curlohair.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) router.replace("/overview");
  }, [hydrated, token, router]);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const tokens = await login(email, password);
      setAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      const me = await fetchMe();
      setUser(me);
      router.replace("/overview");
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-xl p-6"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: COLORS.primary }}
          >
            <ListChecks size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold">TaskFlow</span>
        </div>

        <label className="block text-xs font-semibold mb-1 text-muted">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm mb-3 bg-bg outline-none"
          style={{ border: `1px solid ${COLORS.border}` }}
        />

        <label className="block text-xs font-semibold mb-1 text-muted">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full px-3 py-2 rounded-md text-sm mb-4 bg-bg outline-none"
          style={{ border: `1px solid ${COLORS.border}` }}
        />

        {error && <p className="text-xs mb-3" style={{ color: COLORS.danger }}>{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-2.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50"
          style={{ background: COLORS.primary }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-[11px] text-muted mb-2">
            Seeded accounts (password: <span className="font-mono">password123</span>)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SEED_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => setEmail(u.email)}
                className="text-[11px] px-2 py-1 rounded"
                style={{ background: COLORS.elevated, color: COLORS.muted }}
              >
                {u.email.split("@")[0].replace(/^./, (c) => c.toUpperCase())} · {u.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
