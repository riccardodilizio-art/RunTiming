// Regole di iscrizione "pure" (senza DB): prezzo, sconto, commissione,
// categoria, età. Stessa logica del prototipo frontend (RegisterPage /
// utils/commission), spostata lato server perché il prezzo deve essere
// calcolato dal backend e non fidarsi di quanto invia il browser.

export interface PriceStep {
    id: string;
    label: string;
    price: number;
    /** Ultimo giorno valido, ISO YYYY-MM-DD (incluso). */
    deadline: string;
    commission?: CommissionConfig;
}

export interface CommissionConfig {
    fixedFee: number;
    percentFee: number;
    /** buyer = si aggiunge al prezzo; organizer = trattenuta all'organizzatore. */
    appliedTo: 'buyer' | 'organizer';
}

export interface RaceCategory {
    id?: string;
    name: string;
    gender?: 'M' | 'F';
    minAge?: number;
    maxAge?: number;
}

export interface DiscountLike {
    type: string; // 'fixed' | 'percent'
    value: number;
}

export const ZERO_COMMISSION: CommissionConfig = { fixedFee: 0, percentFee: 0, appliedTo: 'buyer' };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Data di oggi (fuso Europe/Rome) in formato YYYY-MM-DD. */
export function todayRome(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now);
}

/**
 * Quota attiva: tra gli step non ancora scaduti vince il più economico
 * (come nel prototipo). Nessuno step attivo → prezzo base della gara.
 */
export function activePrice(
    basePrice: number,
    steps: PriceStep[] | null | undefined,
    today: string,
): { price: number; label: string; step?: PriceStep } {
    const active = (steps ?? []).filter(s => s.deadline && s.deadline >= today);
    if (!active.length) return { price: basePrice, label: 'Prezzo base' };
    const best = active.reduce((a, b) => (b.price < a.price ? b : a));
    return { price: best.price, label: best.label, step: best };
}

export function discountAmount(price: number, code: DiscountLike | null | undefined): number {
    if (!code) return 0;
    if (code.type === 'fixed') return round2(Math.min(code.value, price));
    return round2(Math.min(price, (price * code.value) / 100));
}

/** Cascata commissione: step > gara > evento > globale. */
export function resolveCommission(
    global: CommissionConfig | null | undefined,
    event?: CommissionConfig | null,
    race?: CommissionConfig | null,
    step?: CommissionConfig | null,
): CommissionConfig {
    return step ?? race ?? event ?? global ?? ZERO_COMMISSION;
}

export function commissionAmount(c: CommissionConfig, priceAfterDiscount: number): number {
    if (priceAfterDiscount <= 0) return 0; // iscrizione gratuita: nessuna commissione
    return round2(c.fixedFee + (priceAfterDiscount * c.percentFee) / 100);
}

/** Metodi di pagamento. paypal comprende anche le carte (gestite da PayPal). */
export type PayMethod = 'paypal' | 'bank' | 'onsite' | 'manual' | 'free';

export interface FeeSettings {
    bankFee: number;
    paypalPercent: number;
    paypalFixed: number;
}

/**
 * Maggiorazione del metodo di pagamento, a carico dell'atleta e incassata da
 * Segreteria del sito: bonifico = fisso (controllo e regolarizzazione), PayPal/carta =
 * percentuale + fisso (costo del circuito). Sul posto e gratuito: nessuna.
 */
export function paymentFee(method: PayMethod, amount: number, s: FeeSettings): number {
    if (amount <= 0) return 0;
    if (method === 'bank') return round2(s.bankFee);
    if (method === 'paypal') return round2((amount * s.paypalPercent) / 100 + s.paypalFixed);
    return 0;
}

/** Metodi ammessi dalla modalità di pagamento della gara. */
export function allowedMethods(paymentMode: string | null | undefined): PayMethod[] {
    switch (paymentMode) {
        case 'online': return ['paypal', 'bank'];            // pagamento anticipato obbligatorio
        case 'both': return ['paypal', 'bank', 'onsite'];    // online facoltativo, si può pagare sul posto
        default: return ['onsite'];                          // 'onsite' / 'none'
    }
}

/** Riepilogo economico dell'iscrizione. `total` è quanto paga l'atleta. */
export function quote(input: {
    basePrice: number;
    steps?: PriceStep[] | null;
    discount?: DiscountLike | null;
    commissions: {
        global?: CommissionConfig | null;
        event?: CommissionConfig | null;
        race?: CommissionConfig | null;
    };
    today: string;
    /** Metodo scelto e maggiorazioni: se assenti, nessuna maggiorazione. */
    method?: PayMethod;
    fees?: FeeSettings;
}) {
    const { price, label, step } = activePrice(input.basePrice, input.steps, input.today);
    const discount = discountAmount(price, input.discount);
    const afterDiscount = round2(Math.max(0, price - discount));
    const c = resolveCommission(
        input.commissions.global,
        input.commissions.event,
        input.commissions.race,
        step?.commission,
    );
    const commission = commissionAmount(c, afterDiscount);
    const subtotal = c.appliedTo === 'buyer' ? round2(afterDiscount + commission) : afterDiscount;
    const fee = input.method && input.fees ? paymentFee(input.method, subtotal, input.fees) : 0;
    const total = round2(subtotal + fee);
    return { price, label, discount, afterDiscount, commission, commissionTo: c.appliedTo, subtotal, paymentFee: fee, total };
}

/**
 * Età "sportiva" FIDAL: anno della gara − anno di nascita
 * (non conta il giorno del compleanno).
 */
export function sportAge(birth: Date, raceDate: Date): number {
    return raceDate.getUTCFullYear() - birth.getUTCFullYear();
}

export function assignCategory(
    categories: RaceCategory[] | null | undefined,
    age: number,
    gender: string,
): RaceCategory | null {
    for (const cat of categories ?? []) {
        if (cat.gender && cat.gender !== gender) continue;
        if (cat.minAge != null && age < cat.minAge) continue;
        if (cat.maxAge != null && age > cat.maxAge) continue;
        return cat;
    }
    return null;
}

/** Messaggio d'errore se l'età non rientra nei limiti della gara, altrimenti null. */
export function checkAge(age: number, minAge?: number | null, maxAge?: number | null): string | null {
    if (minAge != null && age < minAge) return `Età minima per questa gara: ${minAge} anni`;
    if (maxAge != null && age > maxAge) return `Età massima per questa gara: ${maxAge} anni`;
    return null;
}

/** Normalizza un nome per confronti e ricerche (maiuscolo, senza spazi doppi). */
export function normName(s: string | null | undefined): string {
    return (s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

// ─── Chiusura iscrizioni e limite per società ───────────────────────────────

/** Iscrizioni chiuse per data/ora (null = aperte). Dopo la chiusura iscrive solo l'admin. */
export function chiusuraProblem(chiusura: Date | null | undefined, now = new Date()): string | null {
    if (!chiusura || now.getTime() < chiusura.getTime()) return null;
    const quando = new Intl.DateTimeFormat('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
    }).format(chiusura);
    return `Iscrizioni chiuse (${quando}): per richieste scrivi alla segreteria`;
}

/** Messaggio se la società supera il massimo di atleti per la gara (0 = nessun limite). */
export function limiteSocietaProblem(max: number, giaIscritti: number, nuovi: number): string | null {
    if (!max || giaIscritti + nuovi <= max) return null;
    const restano = Math.max(0, max - giaIscritti);
    return `Limite di ${max} atleti per società su questa gara: ${restano ? `potete iscriverne ancora ${restano}` : 'già raggiunto'}`;
}

// ─── Tesseramenti ammessi ───────────────────────────────────────────────────

/**
 * Come si è tesserato l'atleta: FIDAL, Runcard, federazione estera (atleta
 * straniero tesserato nel suo paese), EPS o altro ente, non tesserato.
 */
export type Tesseramento = 'fidal' | 'runcard' | 'estero' | 'eps' | 'libero';
export const TESSERAMENTI: Tesseramento[] = ['fidal', 'runcard', 'estero', 'eps', 'libero'];
export const TESSERAMENTO_LABEL: Record<Tesseramento, string> = {
    fidal: 'FIDAL', runcard: 'Runcard', estero: 'federazioni estere', eps: 'EPS e altri enti', libero: 'non tesserati',
};

/**
 * Ammesso? Come da norme FIDAL, dove è ammessa la Runcard sono ammessi anche gli
 * stranieri tesserati con la federazione del loro paese (con certificato).
 */
export function tesseramentoAmmesso(tipo: Tesseramento, ammessi: Tesseramento[]): boolean {
    return !ammessi.length || ammessi.includes(tipo) || (tipo === 'estero' && ammessi.includes('runcard'));
}

/**
 * Tesseramenti ammessi dalla gara; lista vuota = tutti.
 * Gare salvate prima di questa regola: "ente FIDAL" voleva dire FIDAL o Runcard.
 */
export function ammessiGara(race: { ammessi?: string[] | null; ente?: string | null }): Tesseramento[] {
    const set = (race.ammessi ?? []).filter((t): t is Tesseramento => (TESSERAMENTI as string[]).includes(t));
    if (set.length) return set;
    return (race.ente ?? '').toLowerCase() === 'fidal' ? ['fidal', 'runcard'] : [];
}

/** Tesseramento corrispondente all'ente di un'affiliazione del profilo. */
export function tesseramentoDaEnte(ente: string | null | undefined, societaNome?: string | null): Tesseramento {
    const e = (ente ?? '').toLowerCase();
    if (e === 'fidal') return 'fidal';
    if (e === 'runcard' || /run\s*card/i.test(societaNome ?? '')) return 'runcard';
    if (e === 'estero') return 'estero';
    if (!e || e === 'non_competitiva') return 'libero';
    return 'eps';
}

/** Messaggio d'errore se il tesseramento non è ammesso, altrimenti null. */
export function checkTesseramento(tipo: Tesseramento, ammessi: Tesseramento[]): string | null {
    if (tesseramentoAmmesso(tipo, ammessi)) return null;
    const list = ammessi.map(t => TESSERAMENTO_LABEL[t]);
    const who = ammessi.every(t => t === 'fidal' || t === 'runcard')
        ? `ai tesserati ${list.join(' e ')}`
        : `a: ${list.join(', ')}`;
    return `Questa gara è riservata ${who}`;
}

/** Solo FIDAL (senza Runcard): la tessera deve risultare a FIDAL con stesso cognome e data di nascita. */
export function richiedeFidalVerificato(ammessi: Tesseramento[]): boolean {
    return ammessi.includes('fidal') && !ammessi.includes('runcard');
}

// ─── Minorenni ──────────────────────────────────────────────────────────────
//
// Decisioni della segreteria:
// - di norma per i minori non serve nulla (gare ragazzi, non competitive);
// - se l'organizzazione lo chiede (opzione della gara), per chi ha meno di 18
//   anni il giorno della gara serve la dichiarazione del genitore: nome, cognome
//   e consenso, salvati con l'iscrizione;
// - se lo iscrive la sua società (o lo staff) non serve: garantisce la società;
// - l'account atleta personale si può creare dai 14 anni.

/** Età minima per un account atleta personale (sotto lo iscrive un genitore). */
export const ETA_MIN_ACCOUNT = 14;

/** Testo standard della dichiarazione del genitore (l'organizzazione può cambiarlo). */
export const TESTO_MINORI_STANDARD =
    'Dichiaro di essere il genitore o il tutore legale dell\'atleta minorenne, di autorizzarne la partecipazione '
    + 'alla gara e di aver letto il regolamento.';

/** Età anagrafica (compiuta) in una certa data. */
export function etaAnagrafica(dataNascita: Date | string, giorno: Date | string): number {
    const n = new Date(dataNascita), g = new Date(giorno);
    let eta = g.getUTCFullYear() - n.getUTCFullYear();
    const prima = g.getUTCMonth() < n.getUTCMonth() || (g.getUTCMonth() === n.getUTCMonth() && g.getUTCDate() < n.getUTCDate());
    if (prima) eta--;
    return eta;
}

export interface DichiarazioneGenitore { nome?: string; cognome?: string; consenso?: boolean }

/**
 * Serve la dichiarazione del genitore e manca? Restituisce il messaggio d'errore
 * (null = va bene, oppure non serve).
 */
export function minoreProblem(p: {
    eta: number; richiesta: boolean; viaSocieta: boolean; staff: boolean; genitore?: DichiarazioneGenitore | null;
}): string | null {
    if (!p.richiesta || p.eta >= 18 || p.viaSocieta || p.staff) return null;
    const g = p.genitore;
    if (!g?.nome?.trim() || !g?.cognome?.trim()) return 'Atleta minorenne: indica nome e cognome del genitore o tutore';
    if (g.consenso !== true) return 'Atleta minorenne: serve la dichiarazione del genitore o tutore';
    return null;
}

// ─── Stranieri ──────────────────────────────────────────────────────────────
//
// Decisioni della segreteria:
// - lo straniero si riconosce dalla nazionalità (codice a 3 lettere, ITA di default);
// - tesserato con la federazione del suo paese: federazione e numero di tessera,
//   più il certificato medico che verifica la segreteria;
// - tesserato FIDAL (es. residente in Italia): iscrizione FIDAL normale, ma segnato
//   straniero, per la classifica a parte se la gara la prevede.

/** Nazionalità normalizzata: 3 lettere maiuscole (es. FRA); altrimenti ITA. */
export function nazionalita(v: unknown): string {
    const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
    return /^[A-Z]{3}$/.test(s) ? s : 'ITA';
}

export const isStraniero = (naz: string | null | undefined) => nazionalita(naz) !== 'ITA';
