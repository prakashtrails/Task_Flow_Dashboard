"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store/authStore";

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? "/overview" : "/login");
  }, [token, hydrated, router]);

  return (
    <div className="h-screen flex items-center justify-center text-muted">
      Loading…
    </div>
  );
}
