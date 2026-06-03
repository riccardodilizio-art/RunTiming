import { useRef, useState, useEffect, useCallback } from 'react';
import { CERT_FIELD_LABELS } from './certFields';
import type { CertificateTemplate, CertFieldKey } from '../../types';

/** Larghezza di riferimento: i fontSize dei campi sono espressi a questa larghezza. */
const STD_WIDTH = 1000;

export default function CertificateCanvas({
    template,
    values,
    editable = false,
    selectedKey = null,
    onSelect,
    onMove,
}: {
    template: CertificateTemplate;
    values: Partial<Record<CertFieldKey, string>>;
    editable?: boolean;
    selectedKey?: CertFieldKey | null;
    onSelect?: (k: CertFieldKey) => void;
    onMove?: (k: CertFieldKey, x: number, y: number) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(STD_WIDTH);
    const [dragKey, setDragKey] = useState<CertFieldKey | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);
    const scale = width / STD_WIDTH;

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!dragKey || !onMove || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        onMove(dragKey, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    }, [dragKey, onMove]);

    return (
        <div
            ref={ref}
            onPointerMove={e => editable && handleMove(e.clientX, e.clientY)}
            onPointerUp={() => setDragKey(null)}
            onPointerLeave={() => setDragKey(null)}
            className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 select-none"
            style={{
                aspectRatio: '1.414 / 1',
                backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {template.fields.map(f => (
                <div
                    key={f.key}
                    onPointerDown={() => { if (editable) { setDragKey(f.key); onSelect?.(f.key); } }}
                    className={editable ? 'cursor-move' : ''}
                    style={{
                        position: 'absolute',
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${f.fontSize * scale}px`,
                        color: f.color,
                        fontWeight: f.bold ? 700 : 400,
                        whiteSpace: 'nowrap',
                        lineHeight: 1.1,
                        outline: editable && selectedKey === f.key ? '2px dashed #e8430a' : 'none',
                        outlineOffset: '3px',
                        padding: editable ? '2px' : 0,
                    }}
                >
                    {values[f.key] ?? CERT_FIELD_LABELS[f.key]}
                </div>
            ))}
        </div>
    );
}
