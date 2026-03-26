import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Timer } from 'lucide-react';

const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Eventi', href: '/events' },
    { label: 'Risultati', href: '/results' },
];

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    useEffect(() => { setOpen(false); }, [location]);

    return (
        <header className="bg-dark-800 border-b border-white/5 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-14">

                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center">
                            <Timer className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-700 text-lg text-white tracking-wide">
                            Run<span className="text-brand-400">Timing</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={`text-sm font-medium transition-colors ${
                                    location.pathname === link.href
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <button
                        className="md:hidden text-gray-400 hover:text-white p-1"
                        onClick={() => setOpen(!open)}
                        aria-label="Menu"
                    >
                        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="md:hidden border-t border-white/5 px-4 py-3 space-y-1">
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className="block text-gray-300 hover:text-white py-2 text-sm font-medium"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </header>
    );
}
