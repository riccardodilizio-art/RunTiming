import { useState } from 'react';
import { Plus, Trash2, ClipboardList, SlidersHorizontal, X } from 'lucide-react';
import { newId, inputCls } from './adminShared';
import { CATEGORY_PRESETS, PRESET_GROUPS } from '../../data/categoryPresets';
import type { RaceCategory } from '../../types';

/** Parsa un CSV o JSON e restituisce un array di RaceCategory. Lancia un errore in caso di formato invalido. */
function parseCategoryFile(text: string, filename: string): RaceCategory[] {
    const isJson = filename.toLowerCase().endsWith('.json');

    if (isJson) {
        const raw = JSON.parse(text) as Record<string, unknown>[];
        if (!Array.isArray(raw)) throw new Error('Il file JSON deve contenere un array.');
        return raw.map((r, i) => {
            const name = String(r.nome ?? r.name ?? '').trim();
            if (!name) throw new Error(`Riga ${i + 1}: campo "nome" mancante.`);
            const genderRaw = String(r.sesso ?? r.gender ?? '').toUpperCase();
            const gender = (genderRaw === 'M' || genderRaw === 'F') ? genderRaw as 'M' | 'F' : undefined;
            const minAge = r.eta_min ?? r.minAge;
            const maxAge = r.eta_max ?? r.maxAge;
            return {
                id: newId(),
                name,
                gender,
                minAge: minAge !== undefined && minAge !== '' ? Number(minAge) : undefined,
                maxAge: maxAge !== undefined && maxAge !== '' ? Number(maxAge) : undefined,
            };
        });
    }

    // CSV
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('Il file CSV deve avere almeno una riga di intestazione e una di dati.');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const iNome   = headers.indexOf('nome');
    const iSesso  = headers.indexOf('sesso');
    const iMin    = headers.indexOf('eta_min');
    const iMax    = headers.indexOf('eta_max');
    if (iNome === -1) throw new Error('Colonna "nome" non trovata. Usa il modello CSV come riferimento.');

    return lines.slice(1).map((line, i) => {
        const cols = line.split(',').map(c => c.trim());
        const name = cols[iNome] ?? '';
        if (!name) throw new Error(`Riga ${i + 2}: campo "nome" vuoto.`);
        const genderRaw = iSesso >= 0 ? (cols[iSesso] ?? '').toUpperCase() : '';
        const gender = (genderRaw === 'M' || genderRaw === 'F') ? genderRaw as 'M' | 'F' : undefined;
        const minRaw = iMin >= 0 ? cols[iMin] : '';
        const maxRaw = iMax >= 0 ? cols[iMax] : '';
        return {
            id: newId(),
            name,
            gender,
            minAge: minRaw ? parseInt(minRaw) : undefined,
            maxAge: maxRaw ? parseInt(maxRaw) : undefined,
        };
    });
}

export default function CategoryEditor({
    categories,
    onChange,
}: {
    categories: RaceCategory[];
    onChange: (cats: RaceCategory[]) => void;
}) {
    const [importError, setImportError]     = useState('');
    const [importPreview, setImportPreview] = useState<RaceCategory[] | null>(null);
    const [importLabel, setImportLabel]     = useState('');
    const [showPresetPanel, setShowPresetPanel] = useState(false);

    function add() {
        onChange([...categories, { id: newId(), name: '', gender: undefined, minAge: undefined, maxAge: undefined }]);
    }
    function remove(id: string) { onChange(categories.filter(c => c.id !== id)); }
    function update<K extends keyof RaceCategory>(id: string, key: K, value: RaceCategory[K]) {
        onChange(categories.map(c => c.id === id ? { ...c, [key]: value } : c));
    }

    function applyPreset(presetId: string) {
        const preset = CATEGORY_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        setImportPreview(preset.categories.map(c => ({ ...c, id: newId() })));
        setImportLabel(preset.label);
        setShowPresetPanel(false);
        setImportError('');
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setImportError('');
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = parseCategoryFile(ev.target?.result as string, file.name);
                setImportPreview(parsed);
                setImportLabel(file.name);
            } catch (err) {
                setImportError((err as Error).message);
            }
        };
        reader.readAsText(file);
    }

    function confirmImport(mode: 'replace' | 'append') {
        if (!importPreview) return;
        onChange(mode === 'replace' ? importPreview : [...categories, ...importPreview]);
        setImportPreview(null);
        setImportLabel('');
    }

    return (
        <div className="mt-6 pt-5 border-t border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-slate-700">Categorie agonistiche</h4>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Preset standard */}
                    <button
                        type="button"
                        onClick={() => { setShowPresetPanel(v => !v); setImportError(''); }}
                        className="flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-800 border border-ocean-200 rounded px-2 py-1 hover:bg-ocean-50 transition-colors"
                    >
                        <ClipboardList className="h-3.5 w-3.5" /> Usa preset standard
                    </button>
                    {/* Import file CSV/JSON */}
                    <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition-colors cursor-pointer">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Importa CSV/JSON
                        <input type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
                    </label>
                    {/* Aggiungi manuale */}
                    <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-800 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Aggiungi
                    </button>
                </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
                Seleziona un preset (FIDAL, UISP, …) o importa un file CSV/JSON personalizzato.
                Puoi anche aggiungere categorie manualmente.
            </p>

            {/* Pannello preset */}
            {showPresetPanel && (
                <div className="mb-4 rounded-xl border border-ocean-200 bg-ocean-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-ocean-800">Scegli un preset di categorie</p>
                        <button type="button" onClick={() => setShowPresetPanel(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {PRESET_GROUPS.map(group => (
                            <div key={group}>
                                <p className="text-xs font-bold text-ocean-600 uppercase tracking-wider mb-2">{group}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CATEGORY_PRESETS.filter(p => p.group === group).map(preset => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyPreset(preset.id)}
                                            className="text-left p-3 rounded-lg bg-white border border-ocean-100 hover:border-ocean-400 hover:bg-ocean-50 transition-all group"
                                        >
                                            <p className="text-xs font-semibold text-slate-800 group-hover:text-ocean-700">{preset.label}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{preset.description}</p>
                                            <p className="text-xs text-ocean-500 mt-1">{preset.categories.length} categorie</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Errore importazione */}
            {importError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs mb-3">
                    <X className="h-3.5 w-3.5 shrink-0" /> {importError}
                </div>
            )}

            {/* Preview (preset o file) */}
            {importPreview && (
                <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-ocean-800 mb-1">
                        {importPreview.length} categorie — <span className="font-normal">{importLabel}</span>
                    </p>
                    <div className="text-xs text-ocean-700 mb-3 max-h-40 overflow-y-auto space-y-0.5">
                        {importPreview.map(c => (
                            <div key={c.id} className="flex gap-3">
                                <span className="font-medium w-40 truncate">{c.name}</span>
                                <span className="text-ocean-500 w-8">{c.gender ?? 'M+F'}</span>
                                <span className="text-ocean-500">
                                    {c.minAge ?? '—'}–{c.maxAge ?? '∞'}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {categories.length > 0 && (
                            <button
                                type="button"
                                onClick={() => confirmImport('replace')}
                                className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white text-xs font-semibold hover:bg-ocean-700 transition-colors"
                            >
                                Sostituisci le {categories.length} esistenti
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => confirmImport('append')}
                            className="px-3 py-1.5 rounded-lg bg-white border border-ocean-300 text-ocean-700 text-xs font-semibold hover:bg-ocean-50 transition-colors"
                        >
                            {categories.length > 0 ? 'Aggiungi alle esistenti' : 'Applica'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setImportPreview(null); setImportError(''); }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs hover:bg-slate-50 transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                </div>
            )}

            {/* Lista categorie */}
            {categories.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nessuna categoria configurata.</p>
            ) : (
                <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 font-medium px-0.5">
                        <div className="col-span-4">Nome categoria</div>
                        <div className="col-span-2">Sesso</div>
                        <div className="col-span-2">Età min</div>
                        <div className="col-span-2">Età max</div>
                    </div>
                    {categories.map(cat => (
                        <div key={cat.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4">
                                <input
                                    type="text"
                                    value={cat.name}
                                    onChange={e => update(cat.id, 'name', e.target.value)}
                                    className={inputCls}
                                    placeholder="es. Senior M"
                                />
                            </div>
                            <div className="col-span-2">
                                <select
                                    value={cat.gender ?? ''}
                                    onChange={e => update(cat.id, 'gender', (e.target.value as RaceCategory['gender']) || undefined)}
                                    className={inputCls}
                                >
                                    <option value="">Tutti</option>
                                    <option value="M">M</option>
                                    <option value="F">F</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="number" min={0}
                                    value={cat.minAge ?? ''}
                                    onChange={e => update(cat.id, 'minAge', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={inputCls}
                                    placeholder="—"
                                />
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="number" min={0}
                                    value={cat.maxAge ?? ''}
                                    onChange={e => update(cat.id, 'maxAge', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={inputCls}
                                    placeholder="—"
                                />
                            </div>
                            <div className="col-span-2">
                                <button type="button" onClick={() => remove(cat.id)} className="p-1.5 rounded hover:bg-red-50">
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
