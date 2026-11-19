import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
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
              <LogoMark size={34} />
              <span style={{ color: "#fff" }}>Edge</span><span>RX</span>
            </Link>
            <span className="spacer" />
            <Link href="/#services" className="hide-sm">Services</Link>
            <Link href="/about" className="hide-sm">About</Link>
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
          <div className="container flex between" style={{ alignItems: "flex-start", gap: 24 }}>
            <div>
              <div className="brand"><LogoMark size={30} />{BUSINESS_NAME}</div>
              <div style={{ marginTop: 8 }}>Ski &amp; snowboard tuning · Free pickup &amp; drop off with every tune</div>
            </div>
            <div className="flex" style={{ gap: 18 }}>
              <Link href="/#services">Services</Link>
              <Link href="/about">About us</Link>
              <Link href="/#conditions">Conditions</Link>
              <Link href="/pic-of-the-week">Pic of the week</Link>
              <Link href="/polls">Polls</Link>
              <Link href="/book">Book</Link>
              <Link href="/shop">Shop</Link>
              <Link href="/account">Account</Link>
            </div>
          </div>
          <div className="container" style={{ marginTop: 20, fontSize: "0.8rem" }}>
            © {new Date().getFullYear()} {BUSINESS_NAME} · Photos from <a href="https://unsplash.com" rel="noopener">Unsplash</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
