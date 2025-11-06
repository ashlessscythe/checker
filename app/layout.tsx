// app/layout.tsx
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Check In/Out App",
  description: "A simple check in/out application",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-192.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}
