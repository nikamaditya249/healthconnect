"use client";

import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("role");
    router.push("/login");
  };

  return (
    <header style={styles.header}>
      <div style={styles.left}>HealthConnect</div>

      <div style={styles.right}>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    height: "56px",
    backgroundColor: "#111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    borderBottom: "2px solid #c62828",
  },
  left: {
    fontSize: "18px",
    fontWeight: "600",
  },
  right: {
    display: "flex",
    alignItems: "center",
  },
  logoutBtn: {
    backgroundColor: "#c62828",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    fontSize: "14px",
    borderRadius: "4px",
    cursor: "pointer",
    height: "32px",        // 🔑 THIS fixes oversized button
    lineHeight: "20px",
  },
};