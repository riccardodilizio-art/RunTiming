import { Route } from 'lucide-react';
import { inputCls } from './adminShared';
import type { RouteInfo, ElevationPoint } from '../../types';

function parseProfile(raw: string): ElevationPoint[] {
    return raw
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            const [km, elev] = line.split(',').map(s => parseFloat(s.trim()));
            return { km, elev };
        })
        .filter(p => !isNaN(p.km) && !isNaN(p.elev));
}

function serializeProfile(profile: ElevationPoint[]): string {
    return profile.map(p => `${p.km},${p.elev}`).join('\n');
}

export default function RouteInfoEditor({
    routeInfo,
    onChange,
}: {
    routeInfo?: RouteInfo;
    onChange: (ri: RouteInfo | undefined) => void;
}) {
    const enabled = routeInfo !== undefined;
    const ri = routeInfo ?? { elevationGainM: 0, maxElevationM: 0, minElevationM: 0, terrain: '', profile: [] };

    function update<K extends keyof RouteInfo>(key: K, value: RouteInfo[K]) {
        onChange({ ...ri, [key]: value });
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Route className="h-4 w-4 text-brand-600" /> Percorso altimetrico
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => onChange(e.target.checked ? ri : undefined)}
                        className="accent-brand-600 h-4 w-4"
                    />
                    <span className="text-sm text-slate-600">Includi dati altimetrici</span>
                </label>
            </div>

            {enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dislivello positivo (m)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.elevationGainM}
                            onChange={e => update('elevationGainM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quota massima (m s.l.m.)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.maxElevationM}
                            onChange={e => update('maxElevationM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quota minima (m s.l.m.)</label>
                        <input
                            type="number"
                            min={0}
                            value={ri.minElevationM}
                            onChange={e => update('minElevationM', parseInt(e.target.value) || 0)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo di terreno</label>
                        <input
                            type="text"
                            value={ri.terrain}
                            onChange={e => update('terrain', e.target.value)}
                            className={inputCls}
                            placeholder="es. Asfalto, Sterrato, Misto"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Profilo altimetrico{' '}
                            <span className="font-normal text-slate-400">(una riga per punto: km,quota)</span>
                        </label>
                        <textarea
                            rows={6}
                            value={serializeProfile(ri.profile)}
                            onChange={e => update('profile', parseProfile(e.target.value))}
                            className={`${inputCls} font-mono text-xs`}
                            placeholder={'0,150\n5,210\n10,380\n15,420\n20,150'}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Formato: <code>km,quota</code> — una riga per ogni punto. Es: <code>0,150</code>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
