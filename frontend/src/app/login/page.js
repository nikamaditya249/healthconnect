"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>HealthConnect</h1>
        <p style={styles.subtitle}>Hospital Management System</p>

        <button
          style={{ ...styles.button, ...styles.reception }}
          onClick={() => {
            localStorage.setItem("role", "reception");
            router.push("/reception");
          }}
        >
          Login as Reception
        </button>

        <button
          style={{ ...styles.button, ...styles.doctor }}
          onClick={() => {
            localStorage.setItem("role", "doctor");
            router.push("/doctor");
          }}
        >
          Login as Doctor
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#ffffff",
  },

  card: {
    width: "360px",
    padding: "30px",
    borderRadius: "8px",
    textAlign: "center",
    border: "1px solid #eee",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },

  title: {
    color: "#c62828",
    marginBottom: "5px",
  },

  subtitle: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "25px",
  },

  button: {
    width: "100%",
    padding: "12px",
    fontSize: "15px",
    borderRadius: "5px",
    border: "none",
    cursor: "pointer",
    marginBottom: "12px",
    color: "#fff",
  },

  reception: {
    backgroundColor: "#c62828",
  },

  doctor: {
    backgroundColor: "#b71c1c",
  },
};