"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";

export default function PatientLayout({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader text="Authenticating healthcare session..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title="Patient Electronic Health Record" />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
