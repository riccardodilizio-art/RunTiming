import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-slate-800 text-slate-400 mt-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row items-start justify-between gap-8">

                    <div>
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 bg-ocean-500 rounded-md flex items-center justify-center">
                                <Timer className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-700 text-lg text-white">
                                Run<span className="text-ocean-400">Timing</span>
                            </span>
                        </Link>
                        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                            La piattaforma italiana per il cronometraggio di eventi sportivi amatoriali e professionistici.
                        </p>
                    </div>

                    <div className="flex gap-12">
                        <div>
                            <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Piattaforma</h4>
                            <ul className="space-y-2">
                                {[
                                    { label: 'Home', href: '/' },
                                    { label: 'Eventi', href: '/events' },
                                    { label: 'Risultati', href: '/results' },
                                ].map(l => (
                                    <li key={l.href}>
                                        <Link to={l.href} className="text-slate-500 hover:text-white text-sm transition-colors">
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Supporto</h4>
                            <ul className="space-y-2">
                                {['FAQ', 'Contatti', 'Privacy Policy'].map(item => (
                                    <li key={item}>
                                        <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>

                <div className="border-t border-slate-700 mt-8 pt-5 flex flex-col sm:flex-row justify-between gap-2">
                    <p className="text-slate-600 text-xs">© 2025 RunTiming. Tutti i diritti riservati.</p>
                    <p className="text-slate-600 text-xs font-mono">v1.0.0-alpha</p>
                </div>
            </div>
        </footer>
    );
}
