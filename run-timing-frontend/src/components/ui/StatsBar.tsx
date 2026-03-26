import { useEffect, useRef, useState } from 'react';

interface Stat { value: number; suffix: string; label: string; }

const stats: Stat[] = [
    { value: 1200, suffix: '+', label: 'Gare organizzate' },
    { value: 85000, suffix: '+', label: 'Atleti registrati' },
    { value: 320, suffix: '+', label: 'Organizzatori' },
    { value: 99.9, suffix: '%', label: 'Uptime garantito' },
];

function useCountUp(target: number, active: boolean, duration = 1500) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!active) return;
        const start = performance.now();
        const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(parseFloat((target * eased).toFixed(target % 1 !== 0 ? 1 : 0)));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, active, duration]);
    return count;
}

function StatItem({ stat, active }: { stat: Stat; active: boolean }) {
    const count = useCountUp(stat.value, active);
    return (
        <div className="text-center">
            <div className="font-display font-800 text-4xl md:text-5xl text-gradient">
                {stat.value % 1 !== 0 ? count.toFixed(1) : Math.floor(count).toLocaleString('it-IT')}{stat.suffix}
            </div>
            <div className="text-gray-500 text-sm mt-1 font-body">{stat.label}</div>
        </div>
    );
}

export default function StatsBar() {
    const ref = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setActive(true); },
            { threshold: 0.5 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="relative border-y border-white/5 bg-dark-800/50 backdrop-blur-sm py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((s, i) => <StatItem key={i} stat={s} active={active} />)}
                </div>
            </div>
        </div>
    );
}