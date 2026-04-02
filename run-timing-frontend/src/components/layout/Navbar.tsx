import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Timer, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navLinks = [
    { label: 'Home',          href: '/' },
    { label: 'Eventi',        href: '/events' },
    { label: 'Risultati',     href: '/results' },
    { label: 'Organizzatori', href: '/organizer' },
    { label: 'Contatti',      href: '/contacts' },
];

export default function Navbar() {
    const [open,        setOpen]        = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [scrolled,    setScrolled]    = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout } = useAuth();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // close menus on route change
    useEffect(() => { setOpen(false); setUserMenuOpen(false); }, [location]);

    function handleLogout() {
        logout();
        navigate('/');
    }

    const isLoginPage = location.pathname === '/login';

    return (
        <header className={`sticky top-0 z-50 transition-all duration-200 ${
            scrolled
                ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200'
                : 'bg-white border-b border-slate-200'
        }`}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-14">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-ocean-600 rounded-md flex items-center justify-center">
                            <Timer className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-700 text-lg text-slate-800 tracking-wide">
                            Run<span className="text-ocean-600">Timing</span>
                        </span>
                    </Link>

                    {/* Desktop nav */}
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

                    {/* Right side */}
                    <div className="hidden md:flex items-center gap-2">
                        {currentUser ? (
                            /* ── Logged-in user menu ── */
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(v => !v)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700"
                                >
                                    <div className="w-6 h-6 rounded-full bg-ocean-100 flex items-center justify-center">
                                        <span className="text-ocean-700 text-xs font-bold">
                                            {currentUser.displayName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="font-medium">{currentUser.displayName}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                                        <Link
                                            to="/admin"
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <LayoutDashboard className="w-4 h-4 text-ocean-500" />
                                            Pannello di gestione
                                        </Link>
                                        <div className="border-t border-slate-100 my-1" />
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Esci
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : !isLoginPage ? (
                            /* ── Guest: Accedi button ── */
                            <Link
                                to="/login"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold transition-colors"
                            >
                                Accedi
                            </Link>
                        ) : null}
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="md:hidden text-slate-500 hover:text-slate-900 p-1"
                        onClick={() => setOpen(!open)}
                        aria-label="Menu"
                    >
                        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={`block py-2 text-sm font-medium transition-colors ${
                                location.pathname === link.href ? 'text-ocean-600' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="border-t border-slate-100 pt-2 mt-2">
                        {currentUser ? (
                            <>
                                <Link to="/admin"
                                    className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700 hover:text-ocean-600 transition-colors">
                                    <LayoutDashboard className="w-4 h-4 text-ocean-500" />
                                    Pannello — {currentUser.displayName}
                                </Link>
                                <button onClick={handleLogout}
                                    className="flex items-center gap-2 py-2 text-sm text-red-500 w-full hover:text-red-700 transition-colors">
                                    <LogOut className="w-4 h-4" /> Esci
                                </button>
                            </>
                        ) : !isLoginPage ? (
                            <Link to="/login"
                                className="block py-2 text-sm font-semibold text-ocean-600 hover:text-ocean-800 transition-colors">
                                Accedi
                            </Link>
                        ) : null}
                    </div>
                </div>
            )}
        </header>
    );
}
