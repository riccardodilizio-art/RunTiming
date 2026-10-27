// Mappa provincia (sigla) → regione italiana. Usata per il filtro "Regione"
// nella scoperta eventi (stile ENDU), dato che gli eventi hanno la provincia.

export const PROVINCE_TO_REGION: Record<string, string> = {
    // Abruzzo
    AQ: 'Abruzzo', CH: 'Abruzzo', PE: 'Abruzzo', TE: 'Abruzzo',
    // Basilicata
    MT: 'Basilicata', PZ: 'Basilicata',
    // Calabria
    CZ: 'Calabria', CS: 'Calabria', KR: 'Calabria', RC: 'Calabria', VV: 'Calabria',
    // Campania
    AV: 'Campania', BN: 'Campania', CE: 'Campania', NA: 'Campania', SA: 'Campania',
    // Emilia-Romagna
    BO: 'Emilia-Romagna', FC: 'Emilia-Romagna', FE: 'Emilia-Romagna', MO: 'Emilia-Romagna',
    PC: 'Emilia-Romagna', PR: 'Emilia-Romagna', RA: 'Emilia-Romagna', RE: 'Emilia-Romagna', RN: 'Emilia-Romagna',
    // Friuli-Venezia Giulia
    GO: 'Friuli-Venezia Giulia', PN: 'Friuli-Venezia Giulia', TS: 'Friuli-Venezia Giulia', UD: 'Friuli-Venezia Giulia',
    // Lazio
    FR: 'Lazio', LT: 'Lazio', RI: 'Lazio', RM: 'Lazio', VT: 'Lazio',
    // Liguria
    GE: 'Liguria', IM: 'Liguria', SP: 'Liguria', SV: 'Liguria',
    // Lombardia
    BG: 'Lombardia', BS: 'Lombardia', CO: 'Lombardia', CR: 'Lombardia', LC: 'Lombardia', LO: 'Lombardia',
    MN: 'Lombardia', MI: 'Lombardia', MB: 'Lombardia', PV: 'Lombardia', SO: 'Lombardia', VA: 'Lombardia',
    // Marche
    AN: 'Marche', AP: 'Marche', FM: 'Marche', MC: 'Marche', PU: 'Marche',
    // Molise
    CB: 'Molise', IS: 'Molise',
    // Piemonte
    AL: 'Piemonte', AT: 'Piemonte', BI: 'Piemonte', CN: 'Piemonte', NO: 'Piemonte',
    TO: 'Piemonte', VB: 'Piemonte', VC: 'Piemonte',
    // Puglia
    BA: 'Puglia', BT: 'Puglia', BR: 'Puglia', FG: 'Puglia', LE: 'Puglia', TA: 'Puglia',
    // Sardegna
    CA: 'Sardegna', NU: 'Sardegna', OR: 'Sardegna', SS: 'Sardegna', SU: 'Sardegna',
    // Sicilia
    AG: 'Sicilia', CL: 'Sicilia', CT: 'Sicilia', EN: 'Sicilia', ME: 'Sicilia',
    PA: 'Sicilia', RG: 'Sicilia', SR: 'Sicilia', TP: 'Sicilia',
    // Toscana
    AR: 'Toscana', FI: 'Toscana', GR: 'Toscana', LI: 'Toscana', LU: 'Toscana',
    MS: 'Toscana', PI: 'Toscana', PT: 'Toscana', PO: 'Toscana', SI: 'Toscana',
    // Trentino-Alto Adige
    BZ: 'Trentino-Alto Adige', TN: 'Trentino-Alto Adige',
    // Umbria
    PG: 'Umbria', TR: 'Umbria',
    // Valle d'Aosta
    AO: "Valle d'Aosta",
    // Veneto
    BL: 'Veneto', PD: 'Veneto', RO: 'Veneto', TV: 'Veneto', VE: 'Veneto', VR: 'Veneto', VI: 'Veneto',
};

/** Regione di una provincia (sigla, case-insensitive), o undefined se ignota. */
export function regionOf(province: string | undefined): string | undefined {
    if (!province) return undefined;
    return PROVINCE_TO_REGION[province.trim().toUpperCase()];
}
