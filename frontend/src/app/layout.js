import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/Toast";

export const metadata = {
  title: "HealthConnect | Digital Healthcare Records & OPD Management",
  description:
    "A modern healthcare record and OPD management platform designed to replace paper-based patient records with centralized digital health records, live OPD queues, and AI-assisted clinical summaries.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0 }} suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}