import { useState } from 'react';
import { Plus, Trash2, Award } from 'lucide-react';
import { inputCls } from './adminShared';
import CertificateCanvas from '../../components/certificate/CertificateCanvas';
import { CERT_FIELD_LABELS } from '../../components/certificate/certFields';
import type { CertificateTemplate, CertFieldKey, CertField } from '../../types';

const ALL_KEYS: CertFieldKey[] = ['nome', 'societa', 'evento', 'gara', 'categoria', 'posizione', 'tempo', 'data'];

const SAMPLE: Record<CertFieldKey, string> = {
    nome: 'Mario Rossi', societa: 'ASD Runners Roma', evento: 'Milano City Run',
    gara: 'Maratona 42km', categoria: 'SM', posizione: '1°', tempo: '2:45:10', data: '12/04/2026',
};

export default function CertificateEditor({
    template,
    onChange,
}: {
    template?: CertificateTemplate;
    onChange: (t: CertificateTemplate) => void;
}) {
    const t: CertificateTemplate = template ?? { backgroundUrl: '', fields: [] };
    const [selected, setSelected] = useState<CertFieldKey | null>(null);

    function set(patch: Partial<CertificateTemplate>) { onChange({ ...t, ...patch }); }
    function addField(key: CertFieldKey) {
        if (t.fields.some(f => f.key === key)) return;
        const nf: CertField = { key, x: 50, y: 50, fontSize: 34, color: '#1e293b', bold: false };
        set({ fields: [...t.fields, nf] });
        setSelected(key);
    }
    function updateField(key: CertFieldKey, patch: Partial<CertField>) {
        set({ fields: t.fields.map(f => f.key === key ? { ...f, ...patch } : f) });
    }
    function removeField(key: CertFieldKey) {
        set({ fields: t.fields.filter(f => f.key !== key) });
        if (selected === key) setSelected(null);
    }

    const sel = t.fields.find(f => f.key === selected) ?? null;
    const available = ALL_KEYS.filter(k => !t.fields.some(f => f.key === k));

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-brand-600 mt-0.5" />
                <p className="text-sm text-slate-500">
                    Carica uno sfondo e posiziona i campi trascinandoli. Gli attestati verranno generati per ogni atleta
                    dopo l'import della classifica e saranno scaricabili dal profilo dell'atleta.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL sfondo (immagine attestato)</label>
                <input type="url" value={t.backgroundUrl} onChange={e => set({ backgroundUrl: e.target.value })}
                    className={inputCls} placeholder="https://esempio.com/diploma-sfondo.jpg" />
            </div>

            {/* Campi disponibili */}
            <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Aggiungi campo</p>
                <div className="flex flex-wrap gap-2">
                    {available.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Tutti i campi sono stati aggiunti.</span>
                    ) : available.map(k => (
                        <button key={k} type="button" onClick={() => addField(k)}
                            className="flex items-center gap-1 text-xs border border-brand-200 text-brand-700 rounded px-2 py-1 hover:bg-brand-50 transition-colors">
                            <Plus className="h-3 w-3" /> {CERT_FIELD_LABELS[k]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas + controlli */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <CertificateCanvas
                        template={t}
                        values={SAMPLE}
                        editable
                        selectedKey={selected}
                        onSelect={setSelected}
                        onMove={(k, x, y) => updateField(k, { x, y })}
                    />
                    <p className="text-xs text-slate-400 mt-1">Anteprima con dati di esempio. Trascina i campi per posizionarli.</p>
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500">Campi inseriti</p>
                    {t.fields.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nessun campo. Aggiungine dall'elenco sopra.</p>
                    ) : (
                        <div className="space-y-1">
                            {t.fields.map(f => (
                                <button key={f.key} type="button" onClick={() => setSelected(f.key)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${selected === f.key ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                    {CERT_FIELD_LABELS[f.key]}
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" onClick={e => { e.stopPropagation(); removeField(f.key); }} />
                                </button>
                            ))}
                        </div>
                    )}

                    {sel && (
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-500">{CERT_FIELD_LABELS[sel.key]}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] text-slate-500 mb-0.5">Dimensione</label>
                                    <input type="number" min={8} max={120} value={sel.fontSize}
                                        onChange={e => updateField(sel.key, { fontSize: parseInt(e.target.value) || 12 })} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-500 mb-0.5">Colore</label>
                                    <input type="color" value={sel.color}
                                        onChange={e => updateField(sel.key, { color: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" checked={!!sel.bold} onChange={e => updateField(sel.key, { bold: e.target.checked })} className="accent-brand-600" />
                                Grassetto
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] text-slate-500 mb-0.5">X (%)</label>
                                    <input type="number" min={0} max={100} value={sel.x}
                                        onChange={e => updateField(sel.key, { x: parseFloat(e.target.value) || 0 })} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-500 mb-0.5">Y (%)</label>
                                    <input type="number" min={0} max={100} value={sel.y}
                                        onChange={e => updateField(sel.key, { y: parseFloat(e.target.value) || 0 })} className={inputCls} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
