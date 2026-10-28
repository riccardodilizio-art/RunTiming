import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Timer, ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { BrandName } from '../../components/BrandName';

// Layout "back-office" riutilizzabile: sidebar di navigazione a sinistra (desktop)
// o barra con menu a comparsa (mobile) + area contenuti. Usato da admin, società
// e profilo atleta per avere UN SOLO menu dedicato, senza l'header pubblico.

export interface DashboardNavItem {
    key: string;
    label: string;
    icon: ReactNode;
    badge?: number;
}

export default function DashboardLayout({
    title,
    subtitle,
    items,
    active,
    onSelect,
    userLabel,
    onLogout,
    children,
}: {
    title: string;
    subtitle?: string;
    items: DashboardNavItem[];
    active: string;
    onSelect: (key: string) => void;
    userLabel?: string;
    onLogout: () => void;
    children: ReactNode;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const brand = (
        <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-700 text-lg text-slate-800 tracking-wide">
                <BrandName />
            </span>
        </Link>
    );

    const navButtons = (onNavigate?: () => void) => (
        <nav className="space-y-1">
            {items.map(it => (
                <button
                    key={it.key}
                    type="button"
                    onClick={() => { onSelect(it.key); onNavigate?.(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active === it.key
                            ? 'bg-brand-50 text-brand-700 border border-brand-200'
                            : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                    }`}
                >
                    {it.icon}
                    <span className="flex-1 text-left">{it.label}</span>
                    {it.badge ? (
                        <span className="text-[10px] font-semibold bg-brand-600 text-white rounded-full px-1.5 py-0.5">{it.badge}</span>
                    ) : null}
                </button>
            ))}
        </nav>
    );

    const sidebarFooter = (
        <div className="space-y-1 border-t border-slate-100 pt-3">
            <Link to="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                <ExternalLink className="h-4 w-4" /> Vai al sito
            </Link>
            <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
                <LogOut className="h-4 w-4" /> Esci
            </button>
        </div>
    );

    return (
        <main className="min-h-screen bg-slate-50 md:flex">
            {/* ── Sidebar (desktop) ── */}
            <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-white border-r border-slate-200 md:h-screen md:sticky md:top-0 p-4">
                <div className="mb-4 pb-4 border-b border-slate-100">
                    {brand}
                    <div className="mt-3">
                        <p className="font-semibold text-slate-800 text-sm leading-tight">{title}</p>
                        {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">{navButtons()}</div>
                {userLabel && <p className="text-xs text-slate-400 px-3 mb-2 truncate">{userLabel}</p>}
                {sidebarFooter}
            </aside>

            {/* ── Top bar (mobile) ── */}
            <div className="md:hidden">
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {brand}
                        <span className="h-5 w-px bg-slate-200" />
                        <span className="text-sm font-semibold text-slate-700">{title}</span>
                    </div>
                    <button type="button" onClick={() => setMobileOpen(o => !o)} className="text-slate-500 p-1.5">
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
                {mobileOpen && (
                    <div className="bg-white border-b border-slate-200 px-4 py-3 space-y-3">
                        {navButtons(() => setMobileOpen(false))}
                        {sidebarFooter}
                    </div>
                )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-w-0">{children}</div>
        </main>
    );
}
