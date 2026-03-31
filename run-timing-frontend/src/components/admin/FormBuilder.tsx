import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { CATALOG_GROUPS } from '../../data/fieldCatalog';
import type { FormField, CatalogKey, FieldType } from '../../types';
import type { CatalogEntry } from '../../data/fieldCatalog';

interface Props {
    schema: FormField[];
    onChange: (schema: FormField[]) => void;
}

function newId() {
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function catalogEntryToField(entry: CatalogEntry): FormField {
    return {
        id: newId(),
        catalogKey: entry.catalogKey,
        type: entry.type,
        label: entry.label,
        placeholder: undefined,
        required: entry.defaultRequired,
        options: entry.options,
        helperText: entry.helperText,
        readOnly: entry.readOnly,
    };
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Testo' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Telefono' },
    { value: 'date', label: 'Data' },
    { value: 'number', label: 'Numero' },
    { value: 'select', label: 'Selezione' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'textarea', label: 'Area testo' },
];

export default function FormBuilder({ schema, onChange }: Props) {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ anagrafica: true });
    const [customLabel, setCustomLabel] = useState('');
    const [customType, setCustomType] = useState<FieldType>('text');

    const toggleGroup = (key: string) =>
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

    function addFromCatalog(entry: CatalogEntry) {
        if (schema.some(f => f.catalogKey === entry.catalogKey)) return; // already added
        onChange([...schema, catalogEntryToField(entry)]);
    }

    function addCustomField() {
        if (!customLabel.trim()) return;
        const field: FormField = {
            id: newId(),
            type: customType,
            label: customLabel.trim(),
            required: false,
        };
        onChange([...schema, field]);
        setCustomLabel('');
        setCustomType('text');
    }

    function removeField(id: string) {
        onChange(schema.filter(f => f.id !== id));
    }

    function moveField(index: number, dir: -1 | 1) {
        const next = [...schema];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }

    function toggleRequired(id: string) {
        onChange(schema.map(f => f.id === id ? { ...f, required: !f.required } : f));
    }

    function updateLabel(id: string, label: string) {
        onChange(schema.map(f => f.id === id ? { ...f, label } : f));
    }

    const usedKeys = new Set(schema.map(f => f.catalogKey).filter(Boolean) as CatalogKey[]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT — Catalog */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Catalogo campi — clicca per aggiungere
                </p>
                <div className="space-y-2">
                    {CATALOG_GROUPS.map(group => (
                        <div key={group.key} className="border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.key)}
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 transition-colors"
                            >
                                <span>{group.label}</span>
                                {openGroups[group.key]
                                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                    : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </button>
                            {openGroups[group.key] && (
                                <div className="px-2 py-2 space-y-1">
                                    {group.fields.map(entry => {
                                        const used = usedKeys.has(entry.catalogKey);
                                        return (
                                            <button
                                                key={entry.catalogKey}
                                                type="button"
                                                onClick={() => addFromCatalog(entry)}
                                                disabled={used}
                                                className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                                    used
                                                        ? 'text-slate-300 cursor-default bg-slate-50'
                                                        : 'text-slate-700 hover:bg-ocean-50 hover:text-ocean-700 cursor-pointer'
                                                }`}
                                            >
                                                <span>{entry.label}</span>
                                                {used
                                                    ? <span className="text-xs text-slate-300">già aggiunto</span>
                                                    : <Plus className="h-3.5 w-3.5 text-ocean-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Custom field */}
                    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Campo personalizzato</p>
                        <input
                            type="text"
                            value={customLabel}
                            onChange={e => setCustomLabel(e.target.value)}
                            placeholder="Etichetta del campo"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ocean-500"
                        />
                        <div className="flex gap-2">
                            <select
                                value={customType}
                                onChange={e => setCustomType(e.target.value as FieldType)}
                                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ocean-500"
                            >
                                {FIELD_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={addCustomField}
                                disabled={!customLabel.trim()}
                                className="px-3 py-1.5 rounded bg-ocean-600 text-white text-sm disabled:opacity-40 hover:bg-ocean-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT — Schema */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Modulo ({schema.length} campi)
                </p>
                {schema.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg py-12 flex flex-col items-center justify-center text-slate-400">
                        <GripVertical className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">Nessun campo aggiunto</p>
                        <p className="text-xs">Clicca sul catalogo per aggiungere</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {schema.map((field, idx) => (
                            <div
                                key={field.id}
                                className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-3 shadow-sm"
                            >
                                <span className="mt-1 text-slate-300">
                                    <GripVertical className="h-4 w-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={e => updateLabel(field.id, e.target.value)}
                                        className="w-full text-sm font-medium text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-ocean-400 focus:outline-none bg-transparent pb-0.5"
                                    />
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                                            {field.type}
                                        </span>
                                        {field.catalogKey && (
                                            <span className="text-xs text-slate-400">{field.catalogKey}</span>
                                        )}
                                        <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={() => toggleRequired(field.id)}
                                                className="accent-ocean-600 h-3.5 w-3.5"
                                            />
                                            Obbligatorio
                                        </label>
                                        {field.readOnly && (
                                            <span className="text-xs text-amber-500">auto</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => moveField(idx, -1)}
                                        disabled={idx === 0}
                                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5 text-slate-500" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveField(idx, 1)}
                                        disabled={idx === schema.length - 1}
                                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeField(field.id)}
                                        className="p-1 rounded hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
