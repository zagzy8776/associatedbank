import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SkipLink } from '../components/ui';
import { CURRENCIES } from '../lib/currencies';
import {
  ArrowRight, Menu, X, Wallet, TrendingUp,
  Briefcase, Calculator, Globe2, Shield, Lock, Smartphone, Mail, Phone,
  ChevronRight, Landmark, FileText,
  Building2, Banknote, Users, Coins, Headphones,
} from 'lucide-react';

/* Public marketing navigation. These scroll to sections lower down the page —
   there are no sub-pages yet, so anchors are the placeholder behaviour. */
const NAV_ITEMS = [
  { label: 'Checking & Savings', href: '#products' },
  { label: 'Loans & Credit Cards', href: '#highlights' },
  { label: 'Invest & Insure', href: '#rates' },
  { label: 'Business', href: '#business' },
  { label: 'Tools', href: '#learn' },
  { label: 'About', href: '#about' },
];

const PRODUCTS = [
  {
    id: 'checking',
    icon: Wallet,
    title: 'Checking & Savings',
    desc: 'Everyday accounts for spending, saving, and paying bills.',
    cta: 'Explore accounts',
  },
  {
    id: 'multi-currency',
    icon: Globe2,
    title: 'Multi-Currency Accounts',
    desc: 'Hold sterling, dollars, and euros side by side.',
    cta: 'View currencies',
  },
  {
    id: 'digital',
    icon: Smartphone,
    title: 'Online Banking',
    desc: 'Check balances, review transactions, and move money anytime, from any device.',
    cta: 'See online banking',
  },
  {
    id: 'business',
    icon: Briefcase,
    title: 'Business Banking',
    desc: 'Accounts and tools for businesses that operate in more than one currency.',
    cta: 'Business banking',
  },
];

const HIGHLIGHTS = [
  {
    icon: Globe2,
    title: 'Multi-currency accounts',
    desc: 'Pounds, dollars, and euros together in one place.',
  },
  {
    icon: TrendingUp,
    title: 'Competitive rates',
    desc: 'Clear pricing with no surprise charges.',
  },
  {
    icon: Shield,
    title: 'Secure digital banking',
    desc: 'Your money and your information, protected around the clock.',
  },
  {
    icon: Headphones,
    title: 'Support when you need it',
    desc: 'Real people available Monday to Friday.',
  },
];

/* Indicative only — illustrative figures, not live market quotes. */
const RATES = [
  { pair: 'GBP → USD', rate: '1.2710', change: '+0.12%' },
  { pair: 'GBP → EUR', rate: '1.1745', change: '+0.07%' },
  { pair: 'USD → EUR', rate: '0.9240', change: '-0.04%' },
  { pair: 'EUR → GBP', rate: '0.8514', change: '-0.07%' },
];

const ARTICLES = [
  {
    icon: Coins,
    tag: 'Guides',
    readTime: '5 min read',
    title: 'Understanding multi-currency accounts',
    desc: 'How holding GBP, USD, and EUR together works — and when converting between them makes sense.',
  },
  {
    icon: Users,
    tag: 'Overview',
    readTime: '6 min read',
    title: 'How your Rubicon accounts work',
    desc: 'Opening an account, moving money, and reading your statements, in plain English.',
  },
  {
    icon: Calculator,
    tag: 'Money management',
    readTime: '4 min read',
    title: 'Managing your money across GBP, USD and EUR',
    desc: 'Simple habits for keeping track of balances and transfers in three currencies.',
  },
];

const QUICK_LINKS = [
  { label: 'Member Services', href: '#products' },
  { label: 'About', href: '#about' },
  { label: 'Terms', href: '#legal' },
  { label: 'Privacy', href: '#legal' },
  { label: 'Contact', href: '#contact' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  /* Smooth-scroll to a section instead of jumping, and close the mobile menu.
     Uses scrollIntoView so no global CSS changes are needed. */
  const goTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SkipLink />

      {/* Utility bar */}
      <div className="hidden md:block border-b border-slate-800/60 bg-slate-900/60">
        <div className="max-w-6xl mx-auto px-6 h-9 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-amber-500/70" /> SWIFT: RBNKGB2L
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-amber-500/70" /> Client services: +44 (0) 20 7946 0958
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Mon–Fri 08:00–18:00 GMT</span>
          </div>
        </div>
      </div>

      {/* ============== TOP NAVIGATION ============== */}
      <nav className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <a href="#top" onClick={(e) => goTo(e, '#top')} className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-950 text-lg">
              R
            </div>
            <span className="font-semibold tracking-tight text-lg">Rubicon Capital</span>
          </a>

          <div className="hidden lg:flex items-center gap-5 xl:gap-7">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => goTo(e, item.href)}
                className="text-sm text-slate-300 hover:text-amber-400 transition whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-2 text-sm border border-slate-700 hover:border-amber-500/60 hover:text-amber-400 text-slate-200 font-medium px-4 py-2 rounded-lg transition"
            >
              <Lock className="w-3.5 h-3.5" /> Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition"
            >
              Open Account <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden text-slate-300 hover:text-white p-1"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-slate-800/80 bg-slate-950 px-6 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => goTo(e, item.href)}
                className="block text-sm text-slate-300 hover:text-amber-400 py-2.5 border-b border-slate-800/60 last:border-0"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      <main id="main-content">
      {/* ============== HERO ============== */}
      <section id="top" className="relative overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950" />
        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-16 md:pt-24 md:pb-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.1] mb-10">
              Banking in{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                GBP, USD, and EUR
              </span>
            </h1>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-7 py-3.5 rounded-xl transition"
            >
              Open an Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs uppercase tracking-widest text-slate-500">Your holdings</span>
                <span className="text-xs text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Secured
                </span>
              </div>
              <div className="space-y-3">
                {CURRENCIES.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-semibold text-amber-400">
                        {c.code}
                      </span>
                      <span className="text-sm text-slate-300">{c.label} account</span>
                    </span>
                    <Banknote className="w-4 h-4 text-slate-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== PRODUCT CARDS ============== */}
      <section id="products" className="max-w-6xl mx-auto px-6 py-16 md:py-24 scroll-mt-24">
        <div className="max-w-2xl mb-10 md:mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Simple accounts. Clear pricing.
          </h2>
          <p className="text-slate-400 text-lg">
            Choose the accounts that fit the way you bank.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {PRODUCTS.map((p) => (
            <div
              key={p.id}
              id={p.id}
              className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/30 transition scroll-mt-28"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                <p.icon className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">{p.desc}</p>
              <Link
                to="/signup"
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition"
              >
                {p.cta} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ============== RATES / HIGHLIGHTS ============== */}
      <section id="highlights" className="border-y border-slate-800/80 bg-slate-900/40 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-2xl mb-10 md:mb-14">
            <p className="text-amber-400/90 text-sm font-medium tracking-widest uppercase mb-3">
              What We Offer
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              The essentials of good banking
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="flex flex-col sm:flex-row gap-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/30 transition"
              >
                <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <h.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{h.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{h.desc}</p>
                  <a
                    href="#learn"
                    onClick={(e) => goTo(e, '#learn')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition"
                  >
                    Learn More <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Indicative rates strip */}
          <div id="rates" className="mt-10 bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800/80">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <TrendingUp className="w-4 h-4 text-amber-400" /> Indicative exchange rates
              </span>
              <span className="text-xs text-slate-500">Updated daily · illustrative only</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-800/80">
              {RATES.map((r) => (
                <div key={r.pair} className="px-6 py-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{r.pair}</div>
                  <div className="text-2xl font-semibold tabular-nums">{r.rate}</div>
                  <div
                    className={`text-xs mt-1 ${
                      r.change.startsWith('-') ? 'text-slate-500' : 'text-amber-400'
                    }`}
                  >
                    {r.change}
                  </div>
                </div>
              ))}
            </div>
            <p className="px-6 py-4 text-xs text-slate-500 border-t border-slate-800/80 leading-relaxed">
              Rates are shown for illustration only and are not a live quote or an offer to exchange.
              Actual rates are confirmed at the time of a transaction. Cross-currency transfers are not
              currently supported.
            </p>
          </div>
        </div>
      </section>

      {/* ============== EDUCATIONAL / BLOG ============== */}
      <section id="learn" className="max-w-6xl mx-auto px-6 py-16 md:py-24 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-10 md:mb-14">
          <div className="max-w-2xl">
            <p className="text-amber-400/90 text-sm font-medium tracking-widest uppercase mb-3">
              Tools & insights
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Guides to help you bank with confidence
            </h2>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {ARTICLES.map((a) => (
            <div
              key={a.title}
              className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden hover:border-amber-500/30 transition"
            >
              <div className="h-28 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-900 border-b border-slate-800/80 flex items-center justify-center">
                <a.icon className="w-8 h-8 text-amber-400/80" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 text-xs mb-3">
                  <span className="text-amber-400 uppercase tracking-widest">{a.tag}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500">{a.readTime}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2 leading-snug">{a.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{a.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-slate-500">
                  <FileText className="w-3.5 h-3.5 text-amber-500/60" /> Guide coming soon
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-amber-500/60 hover:text-amber-400 text-slate-200 font-medium px-6 py-3 rounded-xl transition"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ============== ABOUT / TRUST ============== */}
      <section id="about" className="border-y border-slate-800/80 bg-slate-900/40 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-amber-400/90 text-sm font-medium tracking-widest uppercase mb-3">
              About Rubicon Capital
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-5">
              Banking built around you
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              We provide personal and business banking with a focus on clarity, security, and
              service.
            </p>
            <div className="space-y-4">
              {[
                { icon: Users, title: 'Personal support', desc: 'A real person to help with account and service requests.' },
                { icon: Lock, title: 'Security first', desc: 'Secure sign-in, and the ability to lock an account instantly.' },
                { icon: FileText, title: 'Clear statements', desc: 'Every transaction listed plainly, with no hidden fees.' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium mb-0.5">{item.title}</div>
                    <div className="text-sm text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8">
            <div>
              <h3 className="font-semibold text-lg mb-2">Ready to get started?</h3>
              <p className="text-sm text-slate-400 mb-6">
                Open your first account in minutes. You can add more currency accounts later.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-xl transition"
                >
                  Open an Account <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 border border-slate-700 hover:border-amber-500/60 hover:text-amber-400 text-slate-200 font-medium px-6 py-3 rounded-xl transition"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

</main>

      <footer className="border-t border-slate-800/80 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand + corporate info */}
          <div id="contact" className="lg:col-span-2 scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-950 text-lg">
                R
              </div>
              <span className="font-semibold tracking-tight text-lg">Rubicon Capital</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-sm">
              Banking in GBP, USD, and EUR — simple, clear, and secure.
            </p>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-amber-500/70 mt-0.5 shrink-0" />
                <span>Corporate office: 1 Cornhill, London EC3V 3NR, United Kingdom</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-amber-500/70 mt-0.5 shrink-0" />
                <span>+44 (0) 20 7946 0958</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-amber-500/70 mt-0.5 shrink-0" />
                <span>clients@rubiconcapital.example</span>
              </li>
              <li className="flex items-start gap-3">
                <Landmark className="w-4 h-4 text-amber-500/70 mt-0.5 shrink-0" />
                <span>SWIFT: RBNKGB2L · Registered in England &amp; Wales</span>
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-200 mb-5">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => goTo(e, link.href)}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500/60" /> {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services + app */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-200 mb-5">
              Banking with us
            </h3>
            <ul className="space-y-3 mb-8">
              <li>
                <Link to="/signup" className="text-sm text-slate-400 hover:text-amber-400 transition">
                  Open an account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-slate-400 hover:text-amber-400 transition">
                  Sign in
                </Link>
              </li>
              <li>
                <a
                  href="#products"
                  onClick={(e) => goTo(e, '#products')}
                  className="text-sm text-slate-400 hover:text-amber-400 transition"
                >
                  Request an additional account
                </a>
              </li>
              <li>
                <a
                  href="#rates"
                  onClick={(e) => goTo(e, '#rates')}
                  className="text-sm text-slate-400 hover:text-amber-400 transition"
                >
                  View exchange rates
                </a>
              </li>
            </ul>

            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-200 mb-4">
              Mobile app
            </h3>
            <div className="flex flex-col gap-3">
              {['App Store', 'Google Play'].map((store) => (
                <span
                  key={store}
                  className="flex items-center justify-between gap-3 border border-slate-800 bg-slate-900/50 rounded-xl px-4 py-2.5 text-sm text-slate-400"
                >
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-500/70" /> {store}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-amber-500/80">
                    Coming Soon
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Legal / disclaimer */}
        <div id="legal" className="border-t border-slate-800/80 scroll-mt-24">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <span>
                © {new Date().getFullYear()} Rubicon Capital. All rights reserved.
              </span>
              <span className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#legal"
                  onClick={(e) => goTo(e, '#legal')}
                  className="hover:text-amber-400 transition"
                >
                  Terms of Service
                </a>
                <a
                  href="#legal"
                  onClick={(e) => goTo(e, '#legal')}
                  className="hover:text-amber-400 transition"
                >
                  Privacy Policy
                </a>
                <a
                  href="#contact"
                  onClick={(e) => goTo(e, '#contact')}
                  className="hover:text-amber-400 transition"
                >
                  Contact
                </a>
                <span className="hidden sm:inline text-slate-700">|</span>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-amber-500/60" /> Secured with 256-bit encryption
                </span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}