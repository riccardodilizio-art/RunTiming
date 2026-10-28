// Testi delle email. Ogni dato inserito da altri (nomi, titoli gara…) passa da
// esc(): niente HTML o link infilati nelle email da chi si iscrive.

export interface MailContent {
    subject: string;
    html: string;
    text: string;
}

const esc = (s: unknown) =>
    String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const giorno = (d: Date | string) =>
    new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
        .format(new Date(d));
/** "MARIO DE LUCA" → "Mario De Luca" (i nomi nel DB sono in maiuscolo). */
const title = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
/** Solo testo semplice nell'oggetto (niente a capo). */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 150);

const FIRMA = 'Segreteria – TimingRun';
const BRAND = '#0f6fde';

/** Cornice comune: semplice, leggibile anche dal telefono e senza immagini esterne. */
function layout(title: string, bodyHtml: string): string {
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${BRAND};padding:18px 24px;color:#ffffff;font-size:20px;font-weight:bold">TimingRun</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${bodyHtml}
<p style="margin:28px 0 0">${FIRMA}</p></td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">Hai ricevuto questa email perché hai usato il sito TimingRun.
Per qualsiasi domanda rispondi pure a questo messaggio.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
    `<p style="margin:22px 0"><a href="${esc(href)}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;

const rows = (pairs: [string, string][]) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0">${pairs
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;width:42%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`)
        .join('')}</table>`;

const textRows = (pairs: [string, string][]) => pairs.map(([k, v]) => `${k}: ${v}`).join('\n');

// ─── Iscrizione ──────────────────────────────────────────────────────────────

export interface RegMailData {
    nome: string;
    cognome: string;
    evento: string;
    gara: string;
    data: Date | string;
    categoria?: string | null;
    importo: number;
    metodo: string | null;        // paypal | bank | onsite | manual | free
    stato: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    paymentRef?: string | null;
    obbligatorio: boolean;        // gara a pagamento anticipato
    bank?: { iban: string; intestatario: string; banca?: string; giorni: number } | null;
    certificatoMancante?: boolean;
    siteUrl: string;
}

const payUrl = (d: RegMailData) => `${d.siteUrl}/pagamento/${encodeURIComponent(d.paymentRef ?? '')}`;

function regSummary(d: RegMailData): [string, string][] {
    return [
        ['Atleta', title(`${d.nome} ${d.cognome}`)],
        ['Evento', d.evento],
        ['Gara', d.gara],
        ['Data', giorno(d.data)],
        ...(d.categoria ? [['Categoria', d.categoria] as [string, string]] : []),
        ['Quota', euro(d.importo)],
    ];
}

/** Conferma di iscrizione: riepilogo + cosa fare per pagare (un'unica email). */
export function registrationMail(d: RegMailData): MailContent {
    const summary = regSummary(d);
    let payHtml = '';
    let payText = '';
    const scadenza = d.obbligatorio
        ? ' La gara prevede il pagamento anticipato: se il pagamento non arriva in tempo l\'iscrizione viene annullata.'
        : '';

    if (d.stato === 'CONFIRMED') {
        payHtml = `<p>La tua iscrizione è <strong>confermata</strong>.</p>`;
        payText = 'La tua iscrizione è confermata.';
    } else if (d.metodo === 'bank' && d.bank) {
        const causale = `${d.paymentRef} ${d.cognome}`;
        const b: [string, string][] = [
            ['Importo', euro(d.importo)],
            ['Intestatario', d.bank.intestatario],
            ['IBAN', d.bank.iban],
            ...(d.bank.banca ? [['Banca', d.bank.banca] as [string, string]] : []),
            ['Causale', causale],
        ];
        payHtml = `<p>Per completare l'iscrizione fai un <strong>bonifico entro ${d.bank.giorni} giorni</strong> con questi dati.
Scrivi la causale esattamente così: ci serve per abbinare il pagamento alla tua iscrizione.${esc(scadenza)}</p>${rows(b)}
<p style="color:#64748b;font-size:13px">L'importo comprende la maggiorazione per la gestione del bonifico. Preferisci pagare con PayPal o carta? Puoi cambiare metodo dalla pagina di pagamento.</p>
${button(payUrl(d), 'Pagina di pagamento')}`;
        payText = `Per completare l'iscrizione fai un bonifico entro ${d.bank.giorni} giorni.${scadenza}\n${textRows(b)}\n\nPagina di pagamento: ${payUrl(d)}`;
    } else if (d.metodo === 'paypal' && d.paymentRef) {
        payHtml = `<p>Il pagamento <strong>non risulta ancora completato</strong>. Puoi pagare con PayPal o carta dal link qui sotto.${esc(scadenza)}</p>
${button(payUrl(d), 'Paga ora')}`;
        payText = `Il pagamento non risulta ancora completato. Paga con PayPal o carta: ${payUrl(d)}${scadenza}`;
    } else if (d.metodo === 'onsite') {
        payHtml = `<p>La quota di <strong>${esc(euro(d.importo))}</strong> si paga sul posto, al ritiro del pettorale.</p>`;
        payText = `La quota di ${euro(d.importo)} si paga sul posto, al ritiro del pettorale.`;
    } else {
        payHtml = `<p>Il pagamento della quota è gestito dall'organizzazione.</p>`;
        payText = `Il pagamento della quota è gestito dall'organizzazione.`;
    }

    const cert = d.certificatoMancante
        ? `<p style="background:#fef3c7;border-radius:8px;padding:10px 12px">Per questa gara serve il <strong>certificato medico</strong>: non risulta ancora verificato. Portalo al ritiro del pettorale (se hai un account puoi anche caricarlo dalla tua area atleta).</p>`
        : '';
    const certText = d.certificatoMancante ? '\n\nPer questa gara serve il certificato medico: non risulta ancora verificato.' : '';

    const subject = oneLine(
        d.stato === 'CONFIRMED'
            ? `Iscrizione confermata – ${d.evento}`
            : d.metodo === 'bank' ? `Iscrizione ricevuta: dati per il bonifico – ${d.evento}` : `Iscrizione ricevuta – ${d.evento}`,
    );
    return {
        subject,
        html: layout(subject, `<p>Ciao ${esc(title(d.nome))},</p><p>abbiamo ricevuto la tua iscrizione.</p>${rows(summary)}${payHtml}${cert}`),
        text: `Ciao ${title(d.nome)},\nabbiamo ricevuto la tua iscrizione.\n\n${textRows(summary)}\n\n${payText}${certText}\n\n${FIRMA}`,
    };
}

/** Pagamento ricevuto (PayPal riuscito o bonifico confermato dalla segreteria). */
export function paymentReceivedMail(d: RegMailData): MailContent {
    const subject = oneLine(`Pagamento ricevuto – ${d.evento}`);
    const summary = regSummary(d);
    return {
        subject,
        html: layout(subject, `<p>Ciao ${esc(title(d.nome))},</p><p>abbiamo ricevuto il pagamento: la tua iscrizione è <strong>confermata</strong>.</p>${rows(summary)}<p>Ci vediamo alla partenza!</p>`),
        text: `Ciao ${title(d.nome)},\nabbiamo ricevuto il pagamento: la tua iscrizione è confermata.\n\n${textRows(summary)}\n\nCi vediamo alla partenza!\n\n${FIRMA}`,
    };
}

/** Promemoria per le gare a pagamento anticipato. */
export function paymentReminderMail(d: RegMailData): MailContent {
    const subject = oneLine(`Promemoria pagamento – ${d.evento}`);
    return {
        subject,
        html: layout(subject, `<p>Ciao ${esc(title(d.nome))},</p><p>non abbiamo ancora ricevuto il pagamento della tua iscrizione.
Questa gara prevede il <strong>pagamento anticipato</strong>: senza pagamento l'iscrizione verrà annullata.</p>${rows(regSummary(d))}
<p>Se hai già fatto il bonifico negli ultimi giorni non serve fare nulla: lo stiamo abbinando.</p>${button(payUrl(d), 'Completa il pagamento')}`),
        text: `Ciao ${title(d.nome)},\nnon abbiamo ancora ricevuto il pagamento della tua iscrizione. Questa gara prevede il pagamento anticipato: senza pagamento l'iscrizione verrà annullata.\n\n${textRows(regSummary(d))}\n\nSe hai già fatto il bonifico negli ultimi giorni non serve fare nulla.\nCompleta il pagamento: ${payUrl(d)}\n\n${FIRMA}`,
    };
}

/** Iscrizione annullata (mancato pagamento anticipato o decisione dell'organizzazione). */
export function cancelledMail(d: RegMailData, motivo: 'mancato_pagamento' | 'organizzazione'): MailContent {
    const subject = oneLine(`Iscrizione annullata – ${d.evento}`);
    const why = motivo === 'mancato_pagamento'
        ? 'non abbiamo ricevuto il pagamento entro il termine previsto per questa gara (pagamento anticipato)'
        : "l'organizzazione ha annullato la tua iscrizione";
    return {
        subject,
        html: layout(subject, `<p>Ciao ${esc(title(d.nome))},</p><p>ti informiamo che la tua iscrizione è stata <strong>annullata</strong> perché ${esc(why)}.</p>${rows(regSummary(d))}
<p>Se pensi che sia un errore, o hai già pagato, rispondi a questa email indicando il codice <strong>${esc(d.paymentRef ?? '')}</strong>.</p>`),
        text: `Ciao ${title(d.nome)},\nti informiamo che la tua iscrizione è stata annullata perché ${why}.\n\n${textRows(regSummary(d))}\n\nSe pensi che sia un errore, o hai già pagato, rispondi a questa email indicando il codice ${d.paymentRef ?? ''}.\n\n${FIRMA}`,
    };
}

// ─── Account ─────────────────────────────────────────────────────────────────

export function passwordResetMail(link: string, minuti: number): MailContent {
    const subject = 'Reimposta la password del tuo account TimingRun';
    return {
        subject,
        html: layout(subject, `<p>Ciao,</p><p>abbiamo ricevuto una richiesta per reimpostare la password del tuo account TimingRun.</p>
${button(link, 'Scegli una nuova password')}
<p style="color:#64748b;font-size:13px">Il link vale ${minuti} minuti e si può usare una sola volta.
Se non hai chiesto tu di cambiare la password ignora questa email: il tuo account resta com'è.</p>`),
        text: `Ciao,\nabbiamo ricevuto una richiesta per reimpostare la password del tuo account TimingRun.\n\nScegli una nuova password: ${link}\n\nIl link vale ${minuti} minuti e si può usare una sola volta. Se non hai chiesto tu di cambiare la password ignora questa email.\n\n${FIRMA}`,
    };
}
