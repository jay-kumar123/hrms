"use client";

import { useEffect } from "react";
import { AuthProvider } from "./AuthProvider";
import { PropertyProvider } from "@/components/platform/PropertyProvider";

export const DEFAULT_DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItaHItYWRtaW4iLCJlbWFpbCI6ImFkbWluQGhvdGVsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlzU3VwZXJBZG1pbiI6dHJ1ZSwiaWF0IjoxNzg4OTY1NDMxLCJleHAiOjQ5NDI1NjU0MzF9.AQgcCfDXwelhWYzou90YINGcT5rv1TLK-gy0zbYpjus";

const DEFAULT_PROPERTY = JSON.stringify({
  id: "prop-shaw-hotel",
  name: "Shaw Hotel & Resort",
  code: "SHAW",
  role: "admin",
  isSuperAdmin: true,
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pms_token", DEFAULT_DEV_TOKEN);
      if (!localStorage.getItem("pms_active_property")) {
        localStorage.setItem("pms_active_property", DEFAULT_PROPERTY);
      }
    }
  }, []);

  return (
    <AuthProvider>
      <PropertyProvider>{children}</PropertyProvider>
    </AuthProvider>
  );
}
