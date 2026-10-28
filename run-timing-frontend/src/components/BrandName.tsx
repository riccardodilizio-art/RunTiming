import { SITE_NAME, brandParts } from '../lib/brand';

/** Nome del sito per il logo, con la seconda parte colorata (es. Run<b>Timing</b>). */
export function BrandName({ accentClass = 'text-brand-600' }: { accentClass?: string }) {
    const [a, b] = brandParts(SITE_NAME);
    return <>{a}{b && <span className={accentClass}>{b}</span>}</>;
}
