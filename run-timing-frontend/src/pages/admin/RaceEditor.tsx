import { useState, useMemo, useEffect } from 'react';
import {
    Plus, ChevronLeft, Settings, ClipboardList, Trash2, Edit2, Check,
    Euro, Users, UserCheck, Eye, EyeOff, CheckCircle2, UserPlus, Search,
    Download, Trophy, BarChart2, ShieldAlert, X, FileSpreadsheet, Award, ArrowRightLeft, Upload,
} from 'lucide-react';
import ImportClassificaModal from './ImportClassificaModal';
import CertificateEditor from './CertificateEditor';
import { useAdminStore, loadRaceRegistrationsApi, reportApiError, createSyncKeyApi } from '../../hooks/useAdminStore';
import { USE_API, ApiError, api, download } from '../../lib/api';
import FormBuilder from '../../components/admin/FormBuilder';
import DynamicForm from '../../components/registration/DynamicForm';
import { formatPrice, inputCls, downloadCSV } from './adminShared';
import { formatChiusura } from '../../utils/event';
import { ManageRegistrationModal } from '../../components/ManageRegistration';
import { exportEntrantsXlsx } from './exportEntrants';
import CommissionOverrideEditor from './CommissionOverrideEditor';
import PriceStepEditor from './PriceStepEditor';
import CategoryEditor from './CategoryEditor';
import { RaceStatsBar, PaymentBadge, CertBadge } from './RegistrationBadges';
import ManualRegModal from './ManualRegModal';
import ImportIscrittiModal from './ImportIscrittiModal';
import { PRESET_AMMESSI, TESSERAMENTI, TESSERAMENTO_LABEL, ammessiGara, type Tesseramento } from '../../lib/tesseramenti';
import type {
    Race, FormField, PriceStep, RegistrationSubmission, PaymentStatus, CertStatus, Result, ResultStatus, PublicColumn,
} from '../../types';
import { TESTO_MINORI_STANDARD, valoreCampo } from '../../types';

type RaceTab = 'info' | 'form' | 'prices' | 'partecipanti' | 'risultati' | 'attestato';

export default function RaceEditor({
    race,
    eventId,
    raceDate,
    onChange,
    onBack,
    isAdmin = true,
}: {
    race: Race;
    eventId: string;
    /** Data della giornata della gara (per proporre la chiusura iscrizioni). */
    raceDate?: string;
    onChange: (r: Race) => void;
    onBack: () => void;
    isAdmin?: boolean;
}) {
    const [tab, setTab] = useState<RaceTab>(isAdmin ? 'info' : 'partecipanti');
    const [showManualReg, setShowManualReg] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showImportClassifica, setShowImportClassifica] = useState(false);
    const {
        registrations: allRegs,
        updatePaymentStatus, updateCertStatus, updateRegistration, deleteRegistration,
        getResults, saveResults,
    } = useAdminStore();
    const [draftResults, setDraftResults] = useState<Result[]>(() => getResults(race.id));
    const [resultsSaved, setResultsSaved] = useState(false);
    const [syncKey, setSyncKey] = useState<string | null>(null);

    async function generateSyncKey() {
        if (!window.confirm('Generare una nuova chiave semi-live? Quella precedente smetterà di funzionare.')) return;
        try { setSyncKey((await createSyncKeyApi(race.id)).syncKey); }
        catch (e) {
            // Gara appena aggiunta: va prima salvata l'evento
            if (e instanceof ApiError && e.status === 404) window.alert("Salva prima l'evento, poi genera la chiave.");
            else reportApiError(e);
        }
    }
    const [certFilter, setCertFilter] = useState<'all' | 'in_attesa'>('all');
    const [regSearch, setRegSearch] = useState('');
    const [editingAdminReg, setEditingAdminReg] = useState<RegistrationSubmission | null>(null);
    const [changingRegId, setChangingRegId] = useState<string | null>(null);
    const [editAdminFormData, setEditAdminFormData] = useState<Record<string, string | boolean>>({});

    function set<K extends keyof Race>(key: K, value: Race[K]) {
        onChange({ ...race, [key]: value });
    }

    // Con il backend gli iscritti si scaricano quando si apre la scheda Partecipanti.
    // (Una gara appena aggiunta e non ancora salvata non esiste sul server: 404 ignorato.)
    useEffect(() => {
        if (!USE_API || tab !== 'partecipanti') return;
        loadRaceRegistrationsApi(race.id).catch(e => {
            if (!(e instanceof ApiError && e.status === 404)) reportApiError(e);
        });
    }, [tab, race.id]);

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
        { key: 'attestato',     label: 'Attestato',        icon: <Award       className="h-4 w-4" /> },
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
                        <p className="text-xs text-slate-400 mt-1">Ente che organizza o approva la gara. Chi può iscriversi si sceglie qui accanto.</p>
                    </div>
                    <AmmessiEditor race={race} onChange={patch => onChange({ ...race, ...patch })} />
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
                    <ChiusuraEditor race={race} raceDate={raceDate} onChange={patch => onChange({ ...race, ...patch })} />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max atleti per società</label>
                        <input type="number" min={0} value={race.maxPerSocieta || ''} placeholder="Nessun limite"
                            onChange={e => set('maxPerSocieta', parseInt(e.target.value) || 0)} className={inputCls} />
                        <p className="text-xs text-slate-400 mt-1">Vale per le iscrizioni fatte dall'area società.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Staffetta: numero di frazioni</label>
                        <input type="number" min={2} max={10} value={race.staffetta ?? ''} placeholder="Gara individuale"
                            onChange={e => { const n = parseInt(e.target.value); onChange({ ...race, staffetta: n >= 2 && n <= 10 ? n : null }); }} className={inputCls} />
                        <p className="text-xs text-slate-400 mt-1">Il capitano iscrive la squadra con una quota unica (il prezzo della gara è per squadra). Pettorali 101-1, 101-2…</p>
                    </div>
                    <MinoriEditor race={race} onChange={patch => onChange({ ...race, ...patch })} />
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
                    {syncKey && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-slate-700 space-y-1">
                            <p className="font-semibold text-red-700">Dati per il semi-live (config.json sul PC di gara)</p>
                            <p>id_gara: <code className="select-all bg-white px-1 rounded">{race.id}</code></p>
                            <p>chiave: <code className="select-all bg-white px-1 rounded break-all">{syncKey}</code></p>
                            <p className="text-slate-500">La chiave si vede solo ora: copiala. Istruzioni in <code>tools/rr-semilive/README.md</code>.</p>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Inserisci la classifica finale. La posizione è determinata dall'ordine delle righe.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowImportClassifica(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-colors"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" /> Importa da Excel
                            </button>
                            {USE_API && (
                                <button
                                    type="button"
                                    onClick={generateSyncKey}
                                    title="Per il programma che pubblica la classifica dal PC di gara durante la corsa"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Chiave semi-live
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!(await saveResults(race.id, draftResults))) return;
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

                    {showImportClassifica && (
                        <ImportClassificaModal
                            onClose={() => setShowImportClassifica(false)}
                            onImport={async results => {
                                setDraftResults(results);
                                setShowImportClassifica(false);
                                if (!(await saveResults(race.id, results))) return;
                                setResultsSaved(true);
                                setTimeout(() => setResultsSaved(false), 2000);
                            }}
                        />
                    )}
                </div>
            )}

            {tab === 'attestato' && (
                <CertificateEditor
                    template={race.certificateTemplate}
                    onChange={t => set('certificateTemplate', t)}
                />
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

                    {/* Iscrizioni di gruppo delle società */}
                    <GruppoOmaggiEditor value={race.gruppoOmaggi ?? null} onChange={v => set('gruppoOmaggi', v)} />

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

                    {USE_API && (
                        <BibsCard race={race} regs={registrations} onChange={patch => onChange({ ...race, ...patch })} />
                    )}

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
                                        onClick={() => USE_API
                                            ? download(`/races/${race.id}/export.xlsx`, `iscritti-${race.name.replace(/\s+/g, '-').toLowerCase()}.xlsx`).catch(reportApiError)
                                            : exportEntrantsXlsx(race, registrations)}
                                        title="Esporta nel tracciato del cronometraggio"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" /> Excel cronometraggio
                                    </button>
                                )}
                                {USE_API && race.paymentMode === 'online' && registrations.some(r => r.paymentStatus === 'pending') && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const n = registrations.filter(r => r.paymentStatus === 'pending').length;
                                            if (!window.confirm(`Pagamento anticipato obbligatorio: annullare le ${n} iscrizioni non pagate?`)) return;
                                            try {
                                                const r = await api.post<{ cancelled: number }>(`/races/${race.id}/cancel-unpaid`);
                                                window.alert(`${r.cancelled} iscrizioni annullate.`);
                                                await loadRaceRegistrationsApi(race.id, true);
                                            } catch (e) { reportApiError(e); }
                                        }}
                                        title="Annulla le iscrizioni con PayPal/bonifico non ancora pagate"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" /> Annulla non pagati
                                    </button>
                                )}
                                {USE_API && !race.staffetta && (
                                    <button
                                        type="button"
                                        onClick={() => setShowImport(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition-colors"
                                    >
                                        <Upload className="h-3.5 w-3.5" /> Importa da Excel
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
                                                {USE_API && <th className="px-3 py-2">Pett.</th>}
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
                                                    {USE_API && (
                                                        <td className="px-1 py-1">
                                                            <BibInput reg={reg} />
                                                        </td>
                                                    )}
                                                    {formFields.filter(f => !f.readOnly).map(f => (
                                                        <td key={f.id} className="px-3 py-2 text-slate-700">
                                                            {typeof valoreCampo(reg, f) === 'boolean'
                                                                ? (valoreCampo(reg, f) ? '✓' : '—')
                                                                : (valoreCampo(reg, f) as string) || '—'}
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
                                                            {USE_API && isAdmin && reg.paymentStatus !== 'rejected' && (
                                                                <button type="button" onClick={() => setChangingRegId(reg.id)}
                                                                    className="p-1 rounded hover:bg-brand-50 text-slate-400 hover:text-brand-600" title="Cambia gara, cessione, trasferimento">
                                                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
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

                    {showImport && (
                        <ImportIscrittiModal race={race} onClose={() => setShowImport(false)}
                            onDone={() => loadRaceRegistrationsApi(race.id, true).catch(() => undefined)} />
                    )}

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
            {changingRegId && (
                <ManageRegistrationModal regId={changingRegId} onClose={() => { setChangingRegId(null); loadRaceRegistrationsApi(race.id, true).catch(() => undefined); }} />
            )}
        </div>
    );
}

/** Chi può iscriversi: tesseramenti ammessi (+ età minima per i master). */
function AmmessiEditor({ race, onChange }: { race: Race; onChange: (patch: Partial<Race>) => void }) {
    const current = ammessiGara(race);
    const same = (a: Tesseramento[], b: Tesseramento[]) => a.length === b.length && a.every(x => b.includes(x));
    // Prima le scelte con età minima (es. master 35+), poi le altre
    const preset = PRESET_AMMESSI.find(p => p.minAge && same(p.ammessi, current) && race.minAge === p.minAge)
        ?? PRESET_AMMESSI.find(p => !p.minAge && same(p.ammessi, current));
    const [custom, setCustom] = useState(!preset);
    const value = custom || !preset ? 'custom' : preset.id;
    function choose(id: string) {
        if (id === 'custom') { setCustom(true); return; }
        setCustom(false);
        const p = PRESET_AMMESSI.find(x => x.id === id)!;
        const patch: Partial<Race> = { ammessi: p.ammessi };
        if (p.minAge) patch.minAge = p.minAge;
        else if (preset?.minAge && race.minAge === preset.minAge) patch.minAge = undefined;
        onChange(patch);
    }
    function toggle(t: Tesseramento) {
        const base = current.length ? current : TESSERAMENTI;
        const next = base.includes(t) ? base.filter(x => x !== t) : [...base, t];
        if (!next.length) return; // almeno uno
        // Tutti selezionati = nessuna restrizione
        onChange({ ammessi: next.length === TESSERAMENTI.length ? [] : TESSERAMENTI.filter(x => next.includes(x)) });
    }
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chi può iscriversi</label>
            <select value={value} onChange={e => choose(e.target.value)} className={inputCls}>
                {PRESET_AMMESSI.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="custom">Personalizzato…</option>
            </select>
            {value === 'custom' && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {TESSERAMENTI.map(t => (
                        <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                            <input type="checkbox" className="accent-brand-600" checked={!current.length || current.includes(t)}
                                onChange={() => toggle(t)} />
                            {TESSERAMENTO_LABEL[t]}
                        </label>
                    ))}
                </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
                {current.includes('fidal') && !current.includes('runcard')
                    ? 'La tessera FIDAL viene controllata (cognome e data di nascita). Stranieri tesserati FIDAL ammessi.'
                    : 'L\'età si calcola sull\'anno di nascita, come per le categorie FIDAL.'}
            </p>
        </div>
    );
}

/** Omaggi per le iscrizioni di gruppo delle società (es. ogni 10 iscritti, 1 gratis). */
function GruppoOmaggiEditor({ value, onChange }: {
    value: { ogni: number; gratis: number } | null;
    onChange: (v: { ogni: number; gratis: number } | null) => void;
}) {
    const num = (v: string, min: number) => Math.max(min, parseInt(v) || min);
    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Iscrizioni di gruppo delle società</h4>
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-brand-600 h-4 w-4" checked={!!value}
                    onChange={e => onChange(e.target.checked ? { ogni: 10, gratis: 1 } : null)} />
                Quote in omaggio per le società
            </label>
            {value && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-700">
                    ogni
                    <input type="number" min={2} value={value.ogni} className={`${inputCls} !w-20`}
                        onChange={e => { const ogni = num(e.target.value, 2); onChange({ ogni, gratis: Math.min(value.gratis, ogni - 1) }); }} />
                    iscritti della stessa società,
                    <input type="number" min={1} max={value.ogni - 1} value={value.gratis} className={`${inputCls} !w-16`}
                        onChange={e => onChange({ ...value, gratis: Math.min(num(e.target.value, 1), value.ogni - 1) })} />
                    gratis
                </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
                La società iscrive i suoi atleti e paga con un solo bonifico. Si contano tutte le sue iscrizioni a questa gara:
                con "ogni 10, 1 gratis" sono in omaggio il 10°, il 20°… La maggiorazione del bonifico vale per ogni pagante.
            </p>
        </div>
    );
}

/** ISO → valore per <input type="datetime-local"> nell'ora del browser (Italia). */
function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Il giovedì prima della gara alle 23:59 (per le gare di domenica: 3 giorni prima). */
function giovediPrima(raceDate: string): string {
    const d = new Date(raceDate);
    const back = ((d.getDay() - 4 + 7) % 7) || 7; // giorni da tornare indietro fino al giovedì precedente
    d.setDate(d.getDate() - back);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
}

/** Chiusura automatica delle iscrizioni: dopo, iscrive e modifica solo l'admin. */
function ChiusuraEditor({ race, raceDate, onChange }: {
    race: Race; raceDate?: string; onChange: (patch: Partial<Race>) => void;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chiusura iscrizioni</label>
            <input type="datetime-local" className={inputCls}
                value={race.chiusuraIscrizioni ? toLocalInput(race.chiusuraIscrizioni) : ''}
                onChange={e => onChange({ chiusuraIscrizioni: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <div className="flex flex-wrap gap-3 mt-1 text-xs">
                {raceDate && (
                    <button type="button" className="text-brand-600 hover:underline"
                        onClick={() => onChange({ chiusuraIscrizioni: giovediPrima(raceDate) })}>
                        Giovedì prima della gara, 23:59
                    </button>
                )}
                {race.chiusuraIscrizioni && (
                    <button type="button" className="text-slate-500 hover:underline" onClick={() => onChange({ chiusuraIscrizioni: null })}>
                        Togli
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
                {race.chiusuraIscrizioni
                    ? `Chiusura: ${formatChiusura(race.chiusuraIscrizioni)}. Dopo, le iscrizioni le fa solo l'admin.`
                    : 'Vuoto = si chiudono solo a mano (casella "Iscrizioni aperte").'}
            </p>
        </div>
    );
}

/** Assegnazione pettorali della gara: per società, poi cognome e nome. */
function BibsCard({ race, regs, onChange }: {
    race: Race; regs: RegistrationSubmission[]; onChange: (patch: Partial<Race>) => void;
}) {
    const attivi = regs.filter(r => r.paymentStatus !== 'rejected');
    const conPett = attivi.filter(r => r.pettorale != null);
    const senza = attivi.length - conPett.length;
    const [da, setDa] = useState<string>(String(race.pettoraleDa ?? (conPett.length ? Math.min(...conPett.map(r => r.pettorale!)) : 1)));
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    async function assegna(modo: 'tutti' | 'nuovi') {
        const from = parseInt(da) || 1;
        if (modo === 'tutti' && conPett.length
            && !confirm(`Riassegnare i pettorali a tutti i ${attivi.length} iscritti partendo da ${from}? I pettorali già dati cambieranno.`)) return;
        setBusy(true);
        setMsg('');
        try {
            const r = await api.post<{ assegnati: number; da: number | null; a: number | null }>(`/races/${race.id}/bibs`, { modo, da: from });
            setMsg(r.assegnati ? `Assegnati ${r.assegnati} pettorali${r.da ? ` (gara: ${r.da}–${r.a})` : ''}.` : 'Nessun pettorale da assegnare.');
            onChange({ pettoraleDa: from });
            await loadRaceRegistrationsApi(race.id, true);
        } catch (e) {
            reportApiError(e);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Pettorali</h4>
            <p className="text-xs text-slate-500">
                Ordine: società, poi cognome e nome (chi non ha società in fondo). I numeri già usati da altre gare dell'evento si saltano.
                {attivi.length > 0 && ` Con pettorale: ${conPett.length} su ${attivi.length}${senza ? ` · senza: ${senza}` : ''}.`}
            </p>
            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Primo pettorale</label>
                    <input type="number" min={1} value={da} onChange={e => setDa(e.target.value)} className={`${inputCls} !w-28`} />
                </div>
                <button type="button" disabled={busy || attivi.length === 0} onClick={() => assegna('tutti')}
                    className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                    {conPett.length ? 'Riassegna a tutti' : 'Assegna pettorali'}
                </button>
                {conPett.length > 0 && senza > 0 && (
                    <button type="button" disabled={busy} onClick={() => assegna('nuovi')}
                        className="px-3 py-2 rounded-lg border border-brand-300 text-brand-700 text-sm font-medium hover:bg-brand-50 disabled:opacity-50">
                        Solo ai nuovi iscritti ({senza})
                    </button>
                )}
            </div>
            {msg && <p className="text-xs text-green-700">{msg}</p>}
        </div>
    );
}

/** Pettorale modificabile a mano (Invio o uscita dal campo per salvare). */
function BibInput({ reg }: { reg: RegistrationSubmission }) {
    const [v, setV] = useState(reg.pettorale != null ? String(reg.pettorale) : '');
    useEffect(() => setV(reg.pettorale != null ? String(reg.pettorale) : ''), [reg.pettorale]);
    async function save() {
        const next = v.trim() ? parseInt(v) : null;
        if ((next ?? null) === (reg.pettorale ?? null) || (next !== null && !(next > 0))) { setV(reg.pettorale != null ? String(reg.pettorale) : ''); return; }
        try {
            await api.patch(`/registrations/${reg.id}/bib`, { pettorale: next });
            await loadRaceRegistrationsApi(reg.raceId, true);
        } catch (e) {
            reportApiError(e);
            setV(reg.pettorale != null ? String(reg.pettorale) : '');
        }
    }
    return (
        <input type="number" min={1} value={v} onChange={e => setV(e.target.value)} onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            disabled={reg.paymentStatus === 'rejected'}
            className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40" />
    );
}

/** Minorenni: dichiarazione del genitore, solo se l'organizzazione la chiede. */
function MinoriEditor({ race, onChange }: { race: Race; onChange: (patch: Partial<Race>) => void }) {
    return (
        <div className="sm:col-span-2 rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-brand-600 h-4 w-4" checked={!!race.dichiarazioneMinori}
                    onChange={e => onChange({ dichiarazioneMinori: e.target.checked })} />
                Minorenni: chiedi la dichiarazione del genitore
            </label>
            <p className="text-xs text-slate-400">
                Per chi ha meno di 18 anni il giorno della gara: nome e cognome del genitore e una casella di consenso.
                Non serve se l'atleta lo iscrive la sua società. Di norma (gare ragazzi, non competitive) lasciala spenta.
            </p>
            {race.dichiarazioneMinori && (
                <textarea rows={3} maxLength={2000} className={inputCls} placeholder={TESTO_MINORI_STANDARD}
                    value={race.testoMinori ?? ''} onChange={e => onChange({ testoMinori: e.target.value || null })} />
            )}
        </div>
    );
}
