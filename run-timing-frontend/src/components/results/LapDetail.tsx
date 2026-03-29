import type { LapSplit } from '../../types';

interface Props {
    lapSplits: LapSplit[];
    athleteName: string;
}

function parseSeconds(t: string): number {
    const parts = t.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function diff(a: string, b: string): string {
    const d = parseSeconds(a) - parseSeconds(b);
    if (d <= 0) return '—';
    const m = Math.floor(d / 60);
    const s = d % 60;
    return `+${m}:${String(s).padStart(2, '0')}`;
}

export default function LapDetail({ lapSplits, athleteName }: Props) {
    if (!lapSplits.length) return null;

    const times = lapSplits.map(l => parseSeconds(l.split));
    const best  = Math.min(...times);
    const worst = Math.max(...times);
    const bestLap  = lapSplits[times.indexOf(best)];

    return (
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Dettaglio giri — {athleteName}
                </p>
                <span className="text-xs text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                    Miglior giro: {bestLap.split} (giro {bestLap.lap})
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="text-left py-1.5 pr-4 text-slate-400 font-semibold w-12">Giro</th>
                            <th className="text-right py-1.5 pr-4 text-slate-400 font-semibold">Tempo giro</th>
                            <th className="text-right py-1.5 pr-4 text-slate-400 font-semibold">Cumulativo</th>
                            <th className="text-right py-1.5 text-slate-400 font-semibold">vs. miglior giro</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {lapSplits.map((lap, i) => {
                            const secs   = parseSeconds(lap.split);
                            const isBest = secs === best;
                            const isWorst = secs === worst && lapSplits.length > 2;
                            return (
                                <tr
                                    key={lap.lap}
                                    className={`${isBest ? 'bg-teal-50' : isWorst ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : ''}`}
                                >
                                    <td className="py-1.5 pr-4 font-medium text-slate-600">{lap.lap}</td>
                                    <td className={`py-1.5 pr-4 text-right font-mono font-semibold ${isBest ? 'text-teal-600' : isWorst ? 'text-red-500' : 'text-slate-700'}`}>
                                        {lap.split}
                                        {isBest && <span className="ml-1 text-teal-500">▲</span>}
                                        {isWorst && <span className="ml-1 text-red-400">▼</span>}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-slate-500">{lap.cum}</td>
                                    <td className="py-1.5 text-right font-mono text-slate-400">
                                        {isBest ? '—' : diff(lap.split, bestLap.split)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
