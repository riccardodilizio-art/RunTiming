import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';

const links = [
    { label: 'Home', href: '/' },
    { label: 'Eventi', href: '/events' },
    { label: 'Risultati', href: '/results' },
];

export default function Footer() {
    return (
        <footer className="bg-dark-800 border-t border-white/5 mt-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <Link to="/" className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center">
                                <Timer className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-700 text-lg text-white">
                                Run<span className="text-brand-400">Timing</span>
                            </span>
                        </Link>
                        <p className="text-gray-500 text-sm max-w-xs">
                            La piattaforma italiana per il cronometraggio di eventi sportivi.
                        </p>
                    </div>

                    <nav className="flex flex-wrap gap-x-6 gap-y-2">
                        {links.map(link => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className="text-gray-500 hover:text-white text-sm transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="border-t border-white/5 mt-6 pt-5">
                    <p className="text-gray-600 text-xs">© 2025 RunTiming. Tutti i diritti riservati.</p>
                </div>
            </div>
        </footer>
    );
}
