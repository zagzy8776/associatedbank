import { Link } from 'react-router-dom';
import { Shield, Globe2, Lock, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-950 text-lg">
              R
            </div>
            <span className="font-semibold tracking-tight text-lg">Rubicon Capital</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-lg transition"
            >
              Open Account
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
          <p className="text-amber-400/90 text-sm font-medium tracking-widest uppercase mb-4">
            Private Multi-Currency Banking
          </p>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight mb-6">
            Banking built for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
              discerning clients
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
            Hold GBP, USD and EUR in one place. Full transparency, institutional-grade controls,
            and an admin centre that puts you in complete command.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-xl transition"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-200 px-6 py-3 rounded-xl transition"
            >
              Client Login
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-800/80 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Currencies', value: '3' },
            { label: 'Account Types', value: 'Multi' },
            { label: 'Admin Controls', value: 'Full' },
            { label: 'Audit Trail', value: 'Complete' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-semibold text-amber-400 mb-1">{s.value}</div>
              <div className="text-sm text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-semibold text-center mb-4">Everything you need</h2>
        <p className="text-slate-400 text-center mb-16 max-w-xl mx-auto">
          Designed for private clients and the administrators who manage them.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Globe2, title: 'Multi-Currency', desc: 'GBP, USD and EUR accounts with real-time balances and full history.' },
            { icon: Shield, title: 'Admin Control', desc: 'Lock accounts, adjust balances, approve requests, monitor every action.' },
            { icon: Lock, title: 'Secure by Design', desc: 'Role-based access, atomic transfers, and a complete activity audit log.' },
            { icon: BarChart3, title: 'Full Visibility', desc: 'Every deposit, withdrawal and transfer is logged and searchable.' },
          ].map((f) => (
            <div key={f.title} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/30 transition">
              <f.icon className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold mb-4">Ready to open your account?</h2>
          <p className="text-slate-400 mb-8">Create your profile in under a minute. Admin can provision additional accounts on request.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-8 py-3.5 rounded-xl transition"
          >
            Open Account <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            {['Bank-grade security', 'Multi-currency', 'Full admin oversight', 'Audit logging'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-500/70" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Rubicon Capital. All rights reserved.
      </footer>
    </div>
  );
}
