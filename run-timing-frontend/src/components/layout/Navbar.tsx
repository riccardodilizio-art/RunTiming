import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Timer } from 'lucide-react';

const navLinks = [
    { label: 'Home',          href: '/' },
    { label: 'Eventi',        href: '/events' },
    { label: 'Risultati',     href: '/results' },
    { label: 'Organizzatori', href: '/organizer' },
    { label: 'Contatti',      href: '/contacts' },
];

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setOpen(false); }, [location]);

    return (
        <header className={`sticky top-0 z-50 transition-all duration-200 ${
            scrolled
                ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200'
                : 'bg-white border-b border-slate-200'
        }`}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-14">

                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-ocean-600 rounded-md flex items-center justify-center">
                            <Timer className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-700 text-lg text-slate-800 tracking-wide">
                            Run<span className="text-ocean-600">Timing</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-7">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={`text-sm font-medium transition-colors ${
                                    location.pathname === link.href
                                        ? 'text-ocean-600'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <button
                        className="md:hidden text-slate-500 hover:text-slate-900 p-1"
                        onClick={() => setOpen(!open)}
                        aria-label="Menu"
                    >
                        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className="block text-slate-600 hover:text-slate-900 py-2 text-sm font-medium"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </header>
    );
}
