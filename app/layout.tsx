import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { BUSINESS_NAME } from "@/lib/email";

export const metadata: Metadata = {
  title: BUSINESS_NAME,
  description: "Ski and snowboard tuning with free pickup and drop off.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="container">
            <Link href="/" className="logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M2 20 9 7l4 6 3-4 6 11H2Z" fill="#fff" />
                <path d="M9 7 7.2 10.3 9 9.5l1.6 1L9 7Z" fill="#12406b" />
              </svg>
              {BUSINESS_NAME}
            </Link>
            <span className="spacer" />
            <Link href="/#services" className="hide-sm">Services</Link>
            {user?.role === "operator" && <Link href="/admin">Dashboard</Link>}
            {user ? (
              <>
                {user.role === "customer" && <Link href="/account">My account</Link>}
                <a href="/logout" className="hide-sm">Log out</a>
              </>
            ) : (
              <Link href="/login">Log in</Link>
            )}
            {user?.role !== "operator" && (
              <Link href="/book" className="pill">Book<span className="hide-sm"> a tune</span></Link>
            )}
          </div>
        </nav>
        {children}
        <footer className="no-print">
          <div className="container flex between">
            <span>© {new Date().getFullYear()} {BUSINESS_NAME}</span>
            <span>Free pickup &amp; drop off with every tune</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
