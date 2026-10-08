import Link from "next/link";
import { Brand } from "./brand";
import { ArrowUpRight } from "./icons";

export function MarketingHeader() {
  return (
    <header className="marketing-header container">
      <Brand />
      <nav aria-label="Primary navigation">
        <Link href="/features">Features</Link>
        <Link href="/workflows">Workflows</Link>
        <Link href="/about">About</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link" href="/app">Sign in</Link>
        <Link className="button button-dark" href="/demo">Book a demo</Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer container">
      <div><Brand /><p>WhatsApp work, made clear.</p></div>
      <div className="footer-links">
        <Link href="/features">Features</Link><Link href="/workflows">Workflows</Link>
        <Link href="/about">About</Link><Link href="/demo">Demo</Link>
      </div>
      <p className="muted">© 2026 Passion Fruit</p>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="page-intro container">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1><p>{copy}</p>
    </section>
  );
}

export function CTA() {
  return (
    <section className="cta-panel container">
      <div><span className="eyebrow light">Ready when you are</span><h2>Bring every WhatsApp conversation into one calm workspace.</h2></div>
      <Link className="button button-light" href="/demo">Plan your pilot <ArrowUpRight size={17} /></Link>
    </section>
  );
}
