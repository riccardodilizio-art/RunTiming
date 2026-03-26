import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Timer, ChevronRight } from 'lucide-react';

const navLinks = [
    { label: 'Gare', href: '/events' },
    { label: 'Classifiche', href: '/results' },
    { label: 'Atleti', href: '/athletes' },
];

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setOpen(false); }, [location]);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled ? 'bg-dark-900/95 backdrop-blur-md border-b border-white/5 shadow-2xl' : 'bg-transparent'
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center group-hover:bg-brand-400 transition-colors">
                            <Timer className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-800 text-xl tracking-wider text-white">
              RACE<span className="text-gradient">HUB</span>
            </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={`font-body text-sm font-medium tracking-wide transition-colors ${
                                    location.pathname === link.href
                                        ? 'text-brand-400'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-3">
                        <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-3 py-1.5">
                            Accedi
                        </Link>
                        <Link to="/register" className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                            Registrati
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <button className="md:hidden text-gray-300 hover:text-white p-2" onClick={() => setOpen(!open)} aria-label="Menu">
                        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {open && (
                <div className="md:hidden bg-dark-800 border-t border-white/5 px-4 py-4 space-y-3">
                    {navLinks.map(link => (
                        <Link key={link.href} to={link.href} className="block text-gray-300 hover:text-white font-medium py-2 transition-colors">
                            {link.label}
                        </Link>
                    ))}
                    <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                        <Link to="/login" className="text-center text-gray-300 py-2 font-medium">Accedi</Link>
                        <Link to="/register" className="text-center bg-brand-500 text-white py-2.5 rounded-lg font-medium">Registrati</Link>
                    </div>
                </div>
            )}
        </header>
    );
}