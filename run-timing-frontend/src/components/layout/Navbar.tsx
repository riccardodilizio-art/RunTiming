import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Timer, LayoutDashboard, LogOut, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAthleteAuth } from '../../context/AthleteAuthContext';

const navLinks = [
    { label: 'Home',          href: '/' },
    { label: 'Eventi',        href: '/events' },
    { label: 'Risultati',     href: '/results' },
    { label: 'Organizzatori', href: '/organizer' },
    { label: 'Contatti',      href: '/contacts' },
];

export default function Navbar() {
    const [open,           setOpen]           = useState(false);
    const [adminMenuOpen,  setAdminMenuOpen]  = useState(false);
    const [athleteMenuOpen,setAthleteMenuOpen]= useState(false);
    const [scrolled,       setScrolled]       = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, logout: adminLogout }       = useAuth();
    const { currentAthlete, logout: athleteLogout }  = useAthleteAuth();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // close menus on route change
    useEffect(() => {
        setOpen(false);
        setAdminMenuOpen(false);
        setAthleteMenuOpen(false);
    }, [location]);

    function handleAdminLogout() {
        adminLogout();
        navigate('/');
    }

    function handleAthleteLogout() {
        athleteLogout();
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
                            /* ── Admin / organizer menu ── */
                            <div className="relative">
                                <button
                                    onClick={() => setAdminMenuOpen(v => !v)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700"
                                >
                                    <div className="w-6 h-6 rounded-full bg-ocean-100 flex items-center justify-center">
                                        <span className="text-ocean-700 text-xs font-bold">
                                            {currentUser.displayName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="font-medium">{currentUser.displayName}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {adminMenuOpen && (
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
                                            onClick={handleAdminLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Esci
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : currentAthlete ? (
                            /* ── Athlete menu ── */
                            <div className="relative">
                                <button
                                    onClick={() => setAthleteMenuOpen(v => !v)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700"
                                >
                                    <div className="w-6 h-6 rounded-full bg-ocean-100 flex items-center justify-center">
                                        <span className="text-ocean-700 text-xs font-bold">
                                            {currentAthlete.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="font-medium">{currentAthlete.name} {currentAthlete.surname}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${athleteMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {athleteMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                                        <Link
                                            to="/profilo"
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <User className="w-4 h-4 text-ocean-500" />
                                            Il mio profilo
                                        </Link>
                                        <div className="border-t border-slate-100 my-1" />
                                        <button
                                            onClick={handleAthleteLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Esci
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : !isLoginPage ? (
                            /* ── Guest buttons ── */
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/accedi"
                                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
                                >
                                    Accedi
                                </Link>
                                <Link
                                    to="/registrati"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold transition-colors"
                                >
                                    Registrati
                                </Link>
                            </div>
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
                                <button onClick={handleAdminLogout}
                                    className="flex items-center gap-2 py-2 text-sm text-red-500 w-full hover:text-red-700 transition-colors">
                                    <LogOut className="w-4 h-4" /> Esci
                                </button>
                            </>
                        ) : currentAthlete ? (
                            <>
                                <Link to="/profilo"
                                    className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700 hover:text-ocean-600 transition-colors">
                                    <User className="w-4 h-4 text-ocean-500" />
                                    {currentAthlete.name} {currentAthlete.surname}
                                </Link>
                                <button onClick={handleAthleteLogout}
                                    className="flex items-center gap-2 py-2 text-sm text-red-500 w-full hover:text-red-700 transition-colors">
                                    <LogOut className="w-4 h-4" /> Esci
                                </button>
                            </>
                        ) : !isLoginPage ? (
                            <div className="flex flex-col gap-1">
                                <Link to="/accedi"
                                    className="block py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                                    Accedi
                                </Link>
                                <Link to="/registrati"
                                    className="block py-2 text-sm font-semibold text-ocean-600 hover:text-ocean-800 transition-colors">
                                    Registrati
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </header>
    );
}
