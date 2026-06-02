import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-brand-950 text-orange-100/70 mt-10">
            {/* Accent bar tying the footer to the brand */}
            <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row items-start justify-between gap-8">

                    <div>
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center">
                                <Timer className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-700 text-lg text-white">
                                Run<span className="text-brand-400">Timing</span>
                            </span>
                        </Link>
                        <p className="text-orange-100/55 text-sm max-w-xs leading-relaxed">
                            La piattaforma italiana per il cronometraggio di eventi sportivi amatoriali e professionistici.
                        </p>
                    </div>

                    <div className="flex gap-12">
                        <div>
                            <h4 className="text-orange-50 text-xs font-semibold uppercase tracking-wider mb-3">Piattaforma</h4>
                            <ul className="space-y-2">
                                {[
                                    { label: 'Home',          href: '/' },
                                    { label: 'Eventi',        href: '/events' },
                                    { label: 'Risultati',     href: '/results' },
                                    { label: 'Organizzatori', href: '/organizer' },
                                ].map(l => (
                                    <li key={l.href}>
                                        <Link to={l.href} className="text-orange-100/60 hover:text-white text-sm transition-colors">
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-orange-50 text-xs font-semibold uppercase tracking-wider mb-3">Supporto</h4>
                            <ul className="space-y-2">
                                {['FAQ', 'Contatti', 'Privacy Policy'].map(item => (
                                    <li key={item}>
                                        <a href="#" className="text-orange-100/60 hover:text-white text-sm transition-colors">
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>

                <div className="border-t border-brand-800/50 mt-8 pt-5 flex flex-col sm:flex-row justify-between gap-2">
                    <p className="text-orange-200/45 text-xs">© 2025 RunTiming. Tutti i diritti riservati.</p>
                    <p className="text-orange-200/45 text-xs font-mono">v1.0.0-alpha</p>
                </div>
            </div>
        </footer>
    );
}
