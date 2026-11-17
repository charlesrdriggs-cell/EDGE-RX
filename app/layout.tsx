import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { BUSINESS_NAME } from "@/lib/email";
import LogoMark from "@/app/components/LogoMark";

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
              <LogoMark size={30} />
              {BUSINESS_NAME}
            </Link>
            <span className="spacer" />
            <Link href="/#services" className="hide-sm">Services</Link>
            <Link href="/shop" className="hide-sm">Shop</Link>
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
