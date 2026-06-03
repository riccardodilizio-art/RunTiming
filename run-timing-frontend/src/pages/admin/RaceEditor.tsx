import { useState, useMemo } from 'react';
import {
    Plus, ChevronLeft, Settings, ClipboardList, Trash2, Edit2, Check,
    Euro, Users, UserCheck, Eye, EyeOff, CheckCircle2, UserPlus, Search,
    Download, Trophy, BarChart2, ShieldAlert, X,
} from 'lucide-react';
import { useAdminStore } from '../../hooks/useAdminStore';
import FormBuilder from '../../components/admin/FormBuilder';
import DynamicForm from '../../components/registration/DynamicForm';
import { formatPrice, inputCls, downloadCSV } from './adminShared';
import { exportEntrantsXlsx } from './exportEntrants';
import CommissionOverrideEditor from './CommissionOverrideEditor';
import PriceStepEditor from './PriceStepEditor';
import CategoryEditor from './CategoryEditor';
import { RaceStatsBar, PaymentBadge, CertBadge } from './RegistrationBadges';
import ManualRegModal from './ManualRegModal';
import type {
    Race, FormField, PriceStep, RegistrationSubmission, PaymentStatus, CertStatus, Result, ResultStatus, PublicColumn,
} from '../../types';

type RaceTab = 'info' | 'form' | 'prices' | 'partecipanti' | 'risultati';

export default function RaceEditor({
    race,
    eventId,
    onChange,
    onBack,
    isAdmin = true,
}: {
    race: Race;
    eventId: string;
    onChange: (r: Race) => void;
    onBack: () => void;
    isAdmin?: boolean;
}) {
    const [tab, setTab] = useState<RaceTab>(isAdmin ? 'info' : 'partecipanti');
    const [showManualReg, setShowManualReg] = useState(false);
    const {
        registrations: allRegs,
        updatePaymentStatus, updateCertStatus, updateRegistration, deleteRegistration,
        getResults, saveResults,
    } = useAdminStore();
    const [draftResults, setDraftResults] = useState<Result[]>(() => getResults(race.id));
    const [resultsSaved, setResultsSaved] = useState(false);
    const [certFilter, setCertFilter] = useState<'all' | 'in_attesa'>('all');
    const [regSearch, setRegSearch] = useState('');
    const [editingAdminReg, setEditingAdminReg] = useState<RegistrationSubmission | null>(null);
    const [editAdminFormData, setEditAdminFormData] = useState<Record<string, string | boolean>>({});

    function set<K extends keyof Race>(key: K, value: Race[K]) {
        onChange({ ...race, [key]: value });
    }

    // Reactive: re-renders automatically when any registration mutates (no manual re-read).
    const registrations = useMemo(
        () => tab === 'partecipanti' ? allRegs.filter(r => r.raceId === race.id) : [],
        [tab, race.id, allRegs]
    );

    function handlePaymentStatus(regId: string, status: PaymentStatus) {
        updatePaymentStatus(regId, status);
    }

    function handleCertStatus(regId: string, status: CertStatus, reason?: string) {
        updateCertStatus(regId, status, reason);
    }

    function handleDeleteReg(regId: string) {
        deleteRegistration(regId);
    }

    function openAdminEdit(reg: RegistrationSubmission) {
        setEditingAdminReg(reg);
        setEditAdminFormData({ ...reg.formData });
    }

    function handleAdminEditSave() {
        if (!editingAdminReg) return;
        updateRegistration(editingAdminReg.id, { formData: editAdminFormData });
        setEditingAdminReg(null);
    }
    const formFields = race.formSchema ?? [];

    function togglePublicField(fieldId: string) {
        const current = race.publicFields ?? [];
        const next = current.includes(fieldId)
            ? current.filter(f => f !== fieldId)
            : [...current, fieldId];
        set('publicFields', next);
    }

    function togglePublicColumn(col: PublicColumn) {
        const current = race.publicColumns ?? [];
        const next = current.includes(col) ? current.filter(c => c !== col) : [...current, col];
        set('publicColumns', next);
    }

    const allTabs: { key: RaceTab; label: string; icon: React.ReactNode }[] = [
        { key: 'info',          label: 'Dettagli',         icon: <Settings    className="h-4 w-4" /> },
        { key: 'form',          label: 'Modulo iscrizione',icon: <ClipboardList className="h-4 w-4" /> },
        { key: 'prices',        label: 'Quote',            icon: <Euro        className="h-4 w-4" /> },
        { key: 'partecipanti',  label: 'Iscritti',         icon: <UserCheck   className="h-4 w-4" /> },
        { key: 'risultati',     label: 'Risultati',        icon: <Trophy      className="h-4 w-4" /> },
    ];
    // L'organizzatore vede solo la gestione iscritti.
    const tabs = isAdmin ? allTabs : allTabs.filter(t => t.key === 'partecipanti');

    return (
        <div>
            <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 mb-4">
                <ChevronLeft className="h-4 w-4" /> Torna alle distanze
            </button>
            <h3 className="font-semibold text-slate-800 text-lg mb-4">{race.name}</h3>

            {/* Tab bar */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.key
                                ? 'border-brand-600 text-brand-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {tab === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome distanza</label>
                        <input type="text" value={race.name} onChange={e => set('name', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Distanza (es. 21 km)</label>
                        <input type="text" value={race.distance} onChange={e => set('distance', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo gara</label>
                        <select value={race.raceType} onChange={e => set('raceType', e.target.value as Race['raceType'])} className={inputCls}>
                            <option value="linear">Lineare (percorso)</option>
                            <option value="laps_fixed">Giri fissi</option>
                            <option value="laps_timed">Giri a tempo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ente</label>
                        <select value={race.ente ?? 'fidal'} onChange={e => set('ente', e.target.value as Race['ente'])} className={inputCls}>
                            <option value="fidal">FIDAL</option>
                            <option value="uisp">UISP</option>
                            <option value="csi">CSI</option>
                            <option value="acsi">ACSI</option>
                            <option value="aics">AICS</option>
                            <option value="libertas">Libertas</option>
                            <option value="altro">Altro ente</option>
                            <option value="non_competitiva">Non competitiva</option>
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Se FIDAL, l'atleta dovrà iscriversi col tesseramento FIDAL.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modalità pagamento</label>
                        <select value={race.paymentMode ?? 'both'} onChange={e => set('paymentMode', e.target.value as Race['paymentMode'])} className={inputCls}>
                            <option value="both">Online + in loco</option>
                            <option value="online">Solo online</option>
                            <option value="onsite">Solo in loco (giorno gara)</option>
                            <option value="none">Nessun pagamento (gratuita)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo base (€)</label>
                        <input type="number" min={0} step={0.5} value={race.price} onChange={e => set('price', parseFloat(e.target.value) || 0)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max partecipanti</label>
                        <input type="number" min={1} value={race.maxParticipants} onChange={e => set('maxParticipants', parseInt(e.target.value) || 0)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Età min</label>
                        <input type="number" min={0} value={race.minAge ?? ''} onChange={e => set('minAge', e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="—" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Età max</label>
                        <input type="number" min={0} value={race.maxAge ?? ''} onChange={e => set('maxAge', e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls} placeholder="—" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                        <input
                            id="requiresMedicalCert"
                            type="checkbox"
                            checked={race.requiresMedicalCert}
                            onChange={e => set('requiresMedicalCert', e.target.checked)}
                            className="accent-brand-600 h-4 w-4"
                        />
                        <label htmlFor="requiresMedicalCert" className="text-sm text-slate-700">Certificato agonistico richiesto</label>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                        <input
                            id="isOpen"
                            type="checkbox"
                            checked={race.isOpen}
                            onChange={e => set('isOpen', e.target.checked)}
                            className="accent-brand-600 h-4 w-4"
                        />
                        <label htmlFor="isOpen" className="text-sm text-slate-700">Iscrizioni aperte</label>
                    </div>
                    <CategoryEditor
                        categories={race.categories ?? []}
                        onChange={cats => set('categories', cats)}
                    />
                </div>
            )}

            {tab === 'form' && (
                <FormBuilder
                    schema={race.formSchema ?? []}
                    onChange={(schema: FormField[]) => set('formSchema', schema)}
                />
            )}

            {tab === 'risultati' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Inserisci la classifica finale. La posizione è determinata dall'ordine delle righe.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    saveResults(race.id, draftResults);
                                    setResultsSaved(true);
                                    setTimeout(() => setResultsSaved(false), 2000);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
                            >
                                {resultsSaved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Salvato</> : <><Check className="h-3.5 w-3.5" /> Salva classifica</>}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <th className="px-3 py-2 w-10">Pos</th>
                                    <th className="px-3 py-2">N. gara</th>
                                    <th className="px-3 py-2">Atleta</th>
                                    <th className="px-3 py-2">Categoria</th>
                                    <th className="px-3 py-2">Squadra</th>
                                    <th className="px-3 py-2">Tempo</th>
                                    <th className="px-3 py-2">Stato</th>
                                    <th className="px-3 py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {draftResults.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-1.5 text-slate-400 font-medium">{idx + 1}</td>
                                        {(['bib', 'athleteName', 'category', 'team', 'time'] as const).map(field => (
                                            <td key={field} className="px-1.5 py-1">
                                                <input
                                                    type="text"
                                                    value={(r[field] as string) ?? ''}
                                                    onChange={e => {
                                                        const next = [...draftResults];
                                                        next[idx] = { ...next[idx], [field]: e.target.value };
                                                        setDraftResults(next);
                                                    }}
                                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                                                    placeholder={field === 'bib' ? '001' : field === 'time' ? '1:23:45' : ''}
                                                />
                                            </td>
                                        ))}
                                        <td className="px-1.5 py-1">
                                            <select
                                                value={r.status}
                                                onChange={e => {
                                                    const next = [...draftResults];
                                                    next[idx] = { ...next[idx], status: e.target.value as ResultStatus };
                                                    setDraftResults(next);
                                                }}
                                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                                            >
                                                <option value="finisher">Finisher</option>
                                                <option value="dnf">DNF</option>
                                                <option value="dns">DNS</option>
                                                <option value="dsq">DSQ</option>
                                            </select>
                                        </td>
                                        <td className="px-1.5 py-1">
                                            <button
                                                type="button"
                                                onClick={() => setDraftResults(draftResults.filter((_, i) => i !== idx))}
                                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {draftResults.length === 0 && (
                            <p className="text-center text-slate-400 text-xs py-8 italic">
                                Nessun risultato inserito. Aggiungi le righe qui sotto.
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setDraftResults([...draftResults, {
                            position: draftResults.length + 1,
                            bib: '', athleteName: '', category: '', team: '', time: '', status: 'finisher',
                        }])}
                        className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Aggiungi atleta
                    </button>

                    {draftResults.length > 0 && (
                        <p className="text-xs text-slate-400">
                            <BarChart2 className="inline h-3.5 w-3.5 mr-1" />
                            {draftResults.filter(r => r.status === 'finisher').length} finisher
                            · {draftResults.filter(r => r.status === 'dnf').length} DNF
                            · {draftResults.filter(r => r.status === 'dns').length} DNS
                            · {draftResults.filter(r => r.status === 'dsq').length} DSQ
                        </p>
                    )}
                </div>
            )}

            {tab === 'prices' && (
                <div className="max-w-2xl space-y-6">
                    {/* Commissione a livello di gara */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Euro className="h-4 w-4 text-brand-500" /> Commissione per questa gara
                        </h4>
                        <CommissionOverrideEditor
                            commission={race.commission}
                            onChange={c => set('commission', c)}
                            inheritLabel="Eredita dalla commissione dell'evento o globale"
                            examplePrice={race.price || 10}
                        />
                    </div>

                    {/* Quote scaglionate */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Quote scaglionate</h4>
                        <p className="text-sm text-slate-500 mb-3">
                            Il prezzo attivo sarà quello con scadenza più vicina non ancora passata.
                            Se nessuno step è attivo si usa il prezzo base ({formatPrice(race.price)}).
                            Ogni step può avere la propria commissione che sovrascrive quella della gara.
                        </p>
                        <PriceStepEditor
                            steps={race.priceSteps ?? []}
                            onChange={(steps: PriceStep[]) => set('priceSteps', steps)}
                        />
                    </div>
                </div>
            )}

            {tab === 'partecipanti' && (
                <div className="space-y-5">
                    {/* Stats per questa gara */}
                    <RaceStatsBar regs={registrations} />

                    {/* Visibilità pubblica campi */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-brand-500" /> Campi visibili pubblicamente
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">
                            Seleziona quali informazioni degli iscritti sono visibili nella pagina pubblica della manifestazione.
                        </p>
                        {formFields.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessun campo nel modulo. Configura prima il modulo iscrizione.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {formFields.filter(f => !f.readOnly).map(f => {
                                    const isPublic = (race.publicFields ?? []).includes(f.id);
                                    return (
                                        <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={isPublic}
                                                onChange={() => togglePublicField(f.id)}
                                                className="accent-brand-600 h-4 w-4"
                                            />
                                            <span className="text-sm text-slate-700 group-hover:text-brand-700 flex items-center gap-1">
                                                {isPublic
                                                    ? <Eye className="h-3.5 w-3.5 text-brand-500" />
                                                    : <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                                                }
                                                {f.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* Colonne speciali (categoria / pagamento / certificato) */}
                        <div className="mt-4 pt-3 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Colonne aggiuntive</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {([['category', 'Categoria'], ['payment', 'Stato pagamento'], ['cert', 'Stato certificato']] as [PublicColumn, string][]).map(([col, label]) => {
                                    const on = (race.publicColumns ?? []).includes(col);
                                    return (
                                        <label key={col} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={on} onChange={() => togglePublicColumn(col)} className="accent-brand-600 h-4 w-4" />
                                            <span className="text-sm text-slate-700 group-hover:text-brand-700 flex items-center gap-1">
                                                {on ? <Eye className="h-3.5 w-3.5 text-brand-500" /> : <EyeOff className="h-3.5 w-3.5 text-slate-300" />}
                                                {label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Lista iscrizioni */}
                    <div>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Users className="h-4 w-4 text-brand-500" /> Iscritti ({registrations.length})
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Ricerca libera */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cerca iscritto…"
                                        value={regSearch}
                                        onChange={e => setRegSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
                                    />
                                    {regSearch && (
                                        <button onClick={() => setRegSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                {/* Filtro certificati */}
                                {race.requiresMedicalCert && (
                                    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setCertFilter('all')}
                                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${certFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Tutti
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCertFilter('in_attesa')}
                                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${certFilter === 'in_attesa' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <ShieldAlert className="h-3 w-3" />
                                            Cert. da verificare
                                            {registrations.filter(r => r.certStatus === 'in_attesa').length > 0 && (
                                                <span className="ml-0.5 bg-amber-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                                                    {registrations.filter(r => r.certStatus === 'in_attesa').length}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                )}
                                {registrations.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => downloadCSV(race, registrations)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" /> CSV
                                    </button>
                                )}
                                {registrations.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => exportEntrantsXlsx(race, registrations)}
                                        title="Esporta nel tracciato del cronometraggio"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" /> Excel cronometraggio
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowManualReg(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
                                >
                                    <UserPlus className="h-3.5 w-3.5" /> Iscrivi manualmente
                                </button>
                            </div>
                        </div>

                        {(() => {
                            const q = regSearch.toLowerCase().trim();
                            const filtered = registrations
                                .filter(r => certFilter === 'in_attesa' ? r.certStatus === 'in_attesa' : true)
                                .filter(r => {
                                    if (!q) return true;
                                    // cerca in tutti i valori del form + categoria assegnata
                                    const haystack = [
                                        ...Object.values(r.formData).map(v => String(v ?? '')),
                                        r.assignedCategory ?? '',
                                    ].join(' ').toLowerCase();
                                    return haystack.includes(q);
                                });
                            return filtered.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">
                                    {q
                                        ? `Nessun risultato per "${regSearch}".`
                                        : certFilter === 'in_attesa'
                                        ? 'Nessun certificato in attesa di verifica.'
                                        : 'Nessuna iscrizione ricevuta per questa gara.'}
                                </p>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                <th className="px-3 py-2">N°</th>
                                                {formFields.filter(f => !f.readOnly).map(f => (
                                                    <th key={f.id} className="px-3 py-2">
                                                        {f.label}
                                                        {(race.publicFields ?? []).includes(f.id) && (
                                                            <Eye className="inline h-3 w-3 ml-1 text-brand-400" />
                                                        )}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-2">Quota</th>
                                                <th className="px-3 py-2">Pagamento</th>
                                                {race.requiresMedicalCert && (
                                                    <th className="px-3 py-2">Certificato</th>
                                                )}
                                                <th className="px-3 py-2">Data</th>
                                                <th className="px-3 py-2" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filtered.map((reg, idx) => (
                                                <tr key={reg.id} className="hover:bg-slate-50/50">
                                                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                                                    {formFields.filter(f => !f.readOnly).map(f => (
                                                        <td key={f.id} className="px-3 py-2 text-slate-700">
                                                            {typeof reg.formData[f.id] === 'boolean'
                                                                ? (reg.formData[f.id] ? '✓' : '—')
                                                                : (reg.formData[f.id] as string) || '—'}
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-2 font-medium text-brand-700">{formatPrice(reg.pricePaid)}</td>
                                                    <td className="px-3 py-2">
                                                        <PaymentBadge
                                                            status={reg.paymentStatus ?? 'pending'}
                                                            onConfirm={() => handlePaymentStatus(reg.id, 'confirmed')}
                                                            onReject={() => handlePaymentStatus(reg.id, 'rejected')}
                                                            onReset={() => handlePaymentStatus(reg.id, 'pending')}
                                                        />
                                                    </td>
                                                    {race.requiresMedicalCert && (
                                                        <td className="px-3 py-2">
                                                            <CertBadge
                                                                status={reg.certStatus ?? 'in_attesa'}
                                                                certInfo={reg.certInfo}
                                                                fidalVerified={reg.fidalVerified}
                                                                onVerify={() => handleCertStatus(reg.id, 'verificato')}
                                                                onReject={() => {
                                                                    const reason = prompt('Motivo del rifiuto (opzionale):') ?? undefined;
                                                                    handleCertStatus(reg.id, 'rifiutato', reason);
                                                                }}
                                                                onReset={() => handleCertStatus(reg.id, 'in_attesa')}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-slate-400">
                                                        {new Date(reg.submittedAt).toLocaleDateString('it-IT')}
                                                        {reg.addedByOrganizer && (
                                                            <span className="ml-1 text-brand-500" title="Iscrizione manuale">M</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openAdminEdit(reg)}
                                                                className="p-1 rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600"
                                                                title="Modifica iscrizione"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { if (confirm('Eliminare questa iscrizione?')) handleDeleteReg(reg.id); }}
                                                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                                title="Elimina iscrizione"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>

                    {showManualReg && (
                        <ManualRegModal
                            race={race}
                            eventId={eventId}
                            onClose={() => setShowManualReg(false)}
                            onSaved={() => { /* lista reattiva: si aggiorna da sola */ }}
                        />
                    )}

                    {/* Modal modifica iscrizione (admin) */}
                    {editingAdminReg && (() => {
                        const fields = (race.formSchema ?? []).filter(f => !f.readOnly);
                        return (
                            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">Modifica iscrizione</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{race.name}</p>
                                        </div>
                                        <button onClick={() => setEditingAdminReg(null)} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto px-6 py-4 flex-1">
                                        {fields.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Nessun campo modificabile per questa gara.</p>
                                        ) : (
                                            <DynamicForm
                                                fields={fields}
                                                data={editAdminFormData}
                                                onChange={setEditAdminFormData}
                                                errors={{}}
                                            />
                                        )}
                                    </div>
                                    <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
                                        <button
                                            onClick={handleAdminEditSave}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
                                        >
                                            <Check className="h-4 w-4" /> Salva modifiche
                                        </button>
                                        <button
                                            onClick={() => setEditingAdminReg(null)}
                                            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                                        >
                                            Annulla
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
