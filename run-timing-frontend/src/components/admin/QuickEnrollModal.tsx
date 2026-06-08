import { useMemo, useState } from 'react';
import { X, Search, ShieldCheck, ShieldAlert, UserPlus, Check, BadgeCheck } from 'lucide-react';
import { saveRegistration } from '../../hooks/useAdminStore';
import { loadAthleteAccounts } from '../../context/athleteAccounts';
import { lookupByName, lookupByTessera } from '../../data/mockFidal';
import { hasFidalAffiliation, resolveCertStatus } from '../../utils/cert';
import type { CatalogKey, CertStatus, Race, RaceEnte, RegistrationSubmission } from '../../types';

// ─── Candidato all'iscrizione rapida ────────────────────────────────────────────

interface Candidate {
    key: string;
    source: 'account' | 'fidal' | 'manual';
    nome: string;
    cognome: string;
    dataNascita?: string;
    sesso?: 'M' | 'F';
    societa?: string;
    tessera?: string;
    ente: RaceEnte;
    isFidal: boolean;
    accountId?: string;
    accountCertStatus?: CertStatus;
}

/** Costruisce formData con le chiavi = field id del modulo gara (per liste/export). */
function buildFormData(race: Race, c: Candidate): Record<string, string | boolean> {
    const values: Partial<Record<CatalogKey, string | undefined>> = {
        nome: c.nome,
        cognome: c.cognome,
        data_nascita: c.dataNascita,
        anno_nascita: c.dataNascita ? c.dataNascita.slice(0, 4) : undefined,
        sesso: c.sesso,
        societa: c.societa,
        tessera_fidal: c.isFidal ? c.tessera : undefined,
    };
    const out: Record<string, string | boolean> = {};
    for (const f of race.formSchema ?? []) {
        if (f.catalogKey && values[f.catalogKey] !== undefined) {
            out[f.id] = values[f.catalogKey] as string;
        }
    }
    // Fallback: garantisce sempre nome/cognome anche senza modulo configurato.
    out.nome = out.nome || c.nome;
    out.cognome = out.cognome || c.cognome;
    return out;
}

export default function QuickEnrollModal({
    race,
    eventId,
    onClose,
}: {
    race: Race;
    eventId: string;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [manualNome, setManualNome] = useState('');
    const [manualCognome, setManualCognome] = useState('');
    const [price, setPrice] = useState(race.price);
    const [lastEnrolled, setLastEnrolled] = useState<string | null>(null);
    const [enrolledKeys, setEnrolledKeys] = useState<Set<string>>(new Set());

    const accounts = useMemo(() => loadAthleteAccounts(), []);

    const candidates = useMemo<Candidate[]>(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        const out: Candidate[] = [];

        // Account atleti registrati
        for (const a of accounts) {
            const hay = `${a.name} ${a.surname} ${a.email}`.toLowerCase();
            if (!hay.includes(q)) continue;
            const fidal = hasFidalAffiliation(a);
            const aff = (a.affiliations ?? [])[0];
            out.push({
                key: `acc_${a.id}`,
                source: 'account',
                nome: a.name,
                cognome: a.surname,
                dataNascita: a.birthDate,
                sesso: a.gender,
                societa: aff?.societaNome ?? a.club,
                tessera: aff?.numeroTessera ?? a.fidalTessera,
                ente: fidal ? 'fidal' : (aff?.ente ?? 'altro'),
                isFidal: fidal,
                accountId: a.id,
                accountCertStatus: a.certStatus,
            });
        }

        // Database FIDAL (per tessera o per nome/cognome)
        const fidalHits = [
            ...(lookupByTessera(query) ? [lookupByTessera(query)!] : []),
            ...lookupByName(query),
        ];
        const seen = new Set<string>();
        for (const f of fidalHits) {
            if (seen.has(f.tessera)) continue;
            seen.add(f.tessera);
            out.push({
                key: `fidal_${f.tessera}`,
                source: 'fidal',
                nome: f.nome,
                cognome: f.cognome,
                dataNascita: f.dataNascita,
                sesso: f.sesso,
                societa: f.societa,
                tessera: f.tessera,
                ente: f.tipo === 'fidal' ? 'fidal' : 'altro',
                isFidal: f.tipo === 'fidal',
            });
        }
        return out;
    }, [query, accounts]);

    function enroll(c: Candidate) {
        const certStatus = resolveCertStatus({
            requiresMedicalCert: race.requiresMedicalCert,
            affiliation: { ente: c.ente },
            accountCertStatus: c.accountCertStatus,
        });
        const sub: RegistrationSubmission = {
            id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            eventId,
            raceId: race.id,
            submittedAt: new Date().toISOString(),
            formData: buildFormData(race, c),
            pricePaid: price,
            paymentMethod: 'manual',
            paymentStatus: 'confirmed',
            fidalVerified: c.isFidal,
            addedByOrganizer: true,
            athleteAccountId: c.accountId,
            certStatus,
        };
        saveRegistration(sub);
        setEnrolledKeys(prev => new Set(prev).add(c.key));
        setLastEnrolled(`${c.nome} ${c.cognome}`);
    }

    function enrollManual() {
        if (!manualNome.trim() || !manualCognome.trim()) return;
        enroll({
            key: `manual_${Date.now()}`,
            source: 'manual',
            nome: manualNome.trim(),
            cognome: manualCognome.trim(),
            ente: race.ente ?? 'altro',
            isFidal: false,
        });
        setManualNome('');
        setManualCognome('');
    }

    function certBadge(c: Candidate) {
        if (!race.requiresMedicalCert)
            return <span className="text-xs text-slate-400">Cert. non richiesto</span>;
        if (c.isFidal)
            return (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> FIDAL · cert. automatico
                </span>
            );
        if (c.accountCertStatus === 'verificato')
            return (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> Cert. già verificato
                </span>
            );
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                <ShieldAlert className="h-3.5 w-3.5" /> Cert. da verificare
            </span>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h3 className="font-semibold text-slate-800">Iscrizione rapida</h3>
                        <p className="text-xs text-slate-400">{race.name} · €{race.price}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {lastEnrolled && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2.5 text-sm">
                            <Check className="h-4 w-4 shrink-0" />
                            <span><strong>{lastEnrolled}</strong> iscritto. Puoi iscriverne un altro.</span>
                        </div>
                    )}

                    {/* Ricerca */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            Cerca atleta (nome, cognome o tessera FIDAL)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="es. Rossi, RM001234..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* Risultati */}
                    {query.trim().length >= 2 && (
                        <div className="space-y-2">
                            {candidates.length === 0 ? (
                                <p className="text-sm text-slate-400 italic px-1">
                                    Nessun atleta trovato. Aggiungilo manualmente qui sotto.
                                </p>
                            ) : (
                                candidates.map(c => {
                                    const done = enrolledKeys.has(c.key);
                                    return (
                                        <div
                                            key={c.key}
                                            className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-800 text-sm truncate">
                                                        {c.cognome} {c.nome}
                                                    </p>
                                                    <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                                                        {c.source === 'account' ? 'Account' : 'FIDAL'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {c.societa ?? 'Individuale'}
                                                    {c.tessera ? ` · ${c.tessera}` : ''}
                                                </p>
                                                {certBadge(c)}
                                            </div>
                                            <button
                                                onClick={() => enroll(c)}
                                                disabled={done}
                                                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                                    done
                                                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                                        : 'bg-brand-600 hover:bg-brand-700 text-white'
                                                }`}
                                            >
                                                {done ? <><Check className="h-3.5 w-3.5" /> Iscritto</>
                                                      : <><UserPlus className="h-3.5 w-3.5" /> Iscrivi</>}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Aggiunta manuale */}
                    <div className="pt-3 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-600 mb-2">Oppure aggiungi a mano</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={manualNome}
                                onChange={e => setManualNome(e.target.value)}
                                placeholder="Nome"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <input
                                value={manualCognome}
                                onChange={e => setManualCognome(e.target.value)}
                                placeholder="Cognome"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <button
                            onClick={enrollManual}
                            disabled={!manualNome.trim() || !manualCognome.trim()}
                            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                        >
                            <UserPlus className="h-4 w-4" /> Aggiungi e iscrivi
                        </button>
                    </div>

                    {/* Quota */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                        <label className="text-xs font-medium text-slate-600">Quota pagata (€)</label>
                        <input
                            type="number" min={0} step={0.5}
                            value={price}
                            onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                            className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <span className="text-xs text-slate-400">Iscrizione confermata (pagamento manuale).</span>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
}
