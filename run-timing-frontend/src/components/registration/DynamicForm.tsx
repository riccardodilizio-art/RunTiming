import { useEffect } from 'react';
import type { FormField } from '../../types';

interface Props {
    fields: FormField[];
    data: Record<string, string | boolean>;
    onChange: (data: Record<string, string | boolean>) => void;
    errors: Record<string, string>;
}

export default function DynamicForm({ fields, data, onChange, errors }: Props) {
    // Auto-derive anno_nascita from data_nascita
    useEffect(() => {
        const nascitaField = fields.find(f => f.catalogKey === 'data_nascita');
        const annoField = fields.find(f => f.catalogKey === 'anno_nascita');
        if (!nascitaField || !annoField) return;
        const raw = data[nascitaField.id] as string | undefined;
        if (!raw) return;
        const year = new Date(raw).getFullYear();
        if (!isNaN(year) && data[annoField.id] !== String(year)) {
            onChange({ ...data, [annoField.id]: String(year) });
        }
    }, [data, fields, onChange]);

    function handleChange(field: FormField, value: string | boolean) {
        onChange({ ...data, [field.id]: value });
    }

    const inputBase =
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 ' +
        'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 ' +
        'disabled:bg-slate-100 disabled:text-slate-400';

    return (
        <div className="space-y-5">
            {fields.map(field => {
                const value = data[field.id];
                const err = errors[field.id];

                if (field.type === 'checkbox') {
                    return (
                        <div key={field.id} className="flex items-start gap-3">
                            <input
                                id={field.id}
                                type="checkbox"
                                checked={!!value}
                                onChange={e => handleChange(field, e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-ocean-600 cursor-pointer"
                            />
                            <label htmlFor={field.id} className="text-sm text-slate-700 cursor-pointer leading-snug">
                                {field.label}
                                {field.required && <span className="ml-1 text-red-500">*</span>}
                                {field.helperText && (
                                    <span className="block text-xs text-slate-400 mt-0.5">{field.helperText}</span>
                                )}
                            </label>
                            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
                        </div>
                    );
                }

                return (
                    <div key={field.id}>
                        <label htmlFor={field.id} className="block text-sm font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.required && <span className="ml-1 text-red-500">*</span>}
                        </label>

                        {field.type === 'select' ? (
                            <select
                                id={field.id}
                                value={(value as string) ?? ''}
                                onChange={e => handleChange(field, e.target.value)}
                                disabled={field.readOnly}
                                className={inputBase + (err ? ' border-red-400 focus:ring-red-400' : '')}
                            >
                                <option value="">— Seleziona —</option>
                                {field.options?.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : field.type === 'textarea' ? (
                            <textarea
                                id={field.id}
                                rows={3}
                                value={(value as string) ?? ''}
                                placeholder={field.placeholder}
                                onChange={e => handleChange(field, e.target.value)}
                                disabled={field.readOnly}
                                className={inputBase + (err ? ' border-red-400 focus:ring-red-400' : '')}
                            />
                        ) : (
                            <input
                                id={field.id}
                                type={field.type}
                                value={(value as string) ?? ''}
                                placeholder={field.placeholder}
                                onChange={e => handleChange(field, e.target.value)}
                                readOnly={field.readOnly}
                                disabled={field.readOnly}
                                className={inputBase + (err ? ' border-red-400 focus:ring-red-400' : '')}
                            />
                        )}

                        {field.helperText && !err && (
                            <p className="mt-1 text-xs text-slate-400">{field.helperText}</p>
                        )}
                        {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
                    </div>
                );
            })}
        </div>
    );
}
