import type { RaceCategory } from '../types';

export interface CategoryPreset {
    id: string;
    label: string;           // nome visualizzato
    group: string;           // raggruppa nell'UI (es. "FIDAL", "UISP")
    description: string;
    categories: Omit<RaceCategory, 'id'>[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mf(name: string, minAge?: number, maxAge?: number): Omit<RaceCategory, 'id'>[] {
    return [
        { name: `${name} M`, gender: 'M', minAge, maxAge },
        { name: `${name} F`, gender: 'F', minAge, maxAge },
    ];
}

// ─── Preset database ──────────────────────────────────────────────────────────

export const CATEGORY_PRESETS: CategoryPreset[] = [

    // ── FIDAL ─────────────────────────────────────────────────────────────────

    {
        id: 'fidal_strada',
        label: 'Corsa su strada (completo)',
        group: 'FIDAL',
        description: 'Categorie ufficiali FIDAL per gare di corsa su strada: Allievi → Master M/F70.',
        categories: [
            ...mf('Allievi',   16, 17),
            ...mf('Juniores',  18, 19),
            ...mf('Promesse',  20, 22),
            ...mf('Senior',    23, 34),
            ...mf('Master 35', 35, 39),
            ...mf('Master 40', 40, 44),
            ...mf('Master 45', 45, 49),
            ...mf('Master 50', 50, 54),
            ...mf('Master 55', 55, 59),
            ...mf('Master 60', 60, 64),
            ...mf('Master 65', 65, 69),
            ...mf('Master 70', 70, undefined),
        ],
    },

    {
        id: 'fidal_strada_senior',
        label: 'Corsa su strada (Senior + Master)',
        group: 'FIDAL',
        description: 'Solo categorie adulte: Senior (23-34) e Master 35–70.',
        categories: [
            ...mf('Senior',    23, 34),
            ...mf('Master 35', 35, 39),
            ...mf('Master 40', 40, 44),
            ...mf('Master 45', 45, 49),
            ...mf('Master 50', 50, 54),
            ...mf('Master 55', 55, 59),
            ...mf('Master 60', 60, 64),
            ...mf('Master 65', 65, 69),
            ...mf('Master 70', 70, undefined),
        ],
    },

    {
        id: 'fidal_master',
        label: 'Solo Master',
        group: 'FIDAL',
        description: 'Gare riservate ai Master: fascia 35–70+ maschile e femminile.',
        categories: [
            ...mf('Master 35', 35, 39),
            ...mf('Master 40', 40, 44),
            ...mf('Master 45', 45, 49),
            ...mf('Master 50', 50, 54),
            ...mf('Master 55', 55, 59),
            ...mf('Master 60', 60, 64),
            ...mf('Master 65', 65, 69),
            ...mf('Master 70', 70, undefined),
        ],
    },

    {
        id: 'fidal_giovanili',
        label: 'Giovanili',
        group: 'FIDAL',
        description: 'Categorie giovanili FIDAL: Esordienti, Ragazzi, Cadetti, Allievi.',
        categories: [
            ...mf('Esordienti', 8,  10),
            ...mf('Ragazzi',    11, 12),
            ...mf('Cadetti',    13, 14),
            ...mf('Cadetti',    15, 15),
            ...mf('Allievi',    16, 17),
        ],
    },

    {
        id: 'fidal_trail',
        label: 'Trail / Montagna',
        group: 'FIDAL',
        description: 'Categorie per gare di trail running e corsa in montagna.',
        categories: [
            ...mf('Junior',    18, 22),
            ...mf('Senior',    23, 39),
            ...mf('Master 40', 40, 49),
            ...mf('Master 50', 50, 59),
            ...mf('Master 60', 60, undefined),
        ],
    },

    // ── UISP ──────────────────────────────────────────────────────────────────

    {
        id: 'uisp_strada',
        label: 'Corsa su strada',
        group: 'UISP',
        description: 'Categorie UISP standard per podismo su strada.',
        categories: [
            ...mf('Ragazzi',    undefined, 13),
            ...mf('Cadetti',    14, 15),
            ...mf('Juniores',   16, 19),
            ...mf('Senior',     20, 39),
            ...mf('Veterani A', 40, 49),
            ...mf('Veterani B', 50, 59),
            ...mf('Veterani C', 60, undefined),
        ],
    },

    {
        id: 'uisp_nordic',
        label: 'Nordic Walking',
        group: 'UISP',
        description: 'Categorie UISP per gare di Nordic Walking.',
        categories: [
            ...mf('Under 40',   undefined, 39),
            ...mf('Veterani A', 40, 54),
            ...mf('Veterani B', 55, 64),
            ...mf('Veterani C', 65, undefined),
        ],
    },

    // ── CSI ───────────────────────────────────────────────────────────────────

    {
        id: 'csi_strada',
        label: 'Corsa su strada',
        group: 'CSI',
        description: 'Categorie CSI per gare di atletica leggera su strada.',
        categories: [
            ...mf('Ragazzi',    11, 13),
            ...mf('Cadetti',    14, 17),
            ...mf('Junior',     18, 22),
            ...mf('Senior',     23, 34),
            ...mf('Amatori A',  35, 44),
            ...mf('Amatori B',  45, 54),
            ...mf('Amatori C',  55, undefined),
        ],
    },

    // ── Non competitiva ───────────────────────────────────────────────────────

    {
        id: 'non_comp_semplice',
        label: 'Non competitiva semplice',
        group: 'Non competitiva',
        description: 'Due sole categorie: Uomini e Donne, senza limiti d\'età.',
        categories: [
            { name: 'Uomini', gender: 'M', minAge: undefined, maxAge: undefined },
            { name: 'Donne',  gender: 'F', minAge: undefined, maxAge: undefined },
        ],
    },

    {
        id: 'non_comp_fasce',
        label: 'Non competitiva a fasce',
        group: 'Non competitiva',
        description: 'Categorie per fasce d\'età ampie, adatte a gare aperte a tutti.',
        categories: [
            ...mf('Giovanissimi', undefined, 17),
            ...mf('Under 40',     18, 39),
            ...mf('Over 40',      40, 59),
            ...mf('Over 60',      60, undefined),
        ],
    },

    {
        id: 'camminata',
        label: 'Camminata / marcia',
        group: 'Non competitiva',
        description: 'Categorie semplici per camminata non competitiva.',
        categories: [
            { name: 'Giovanissimi', gender: undefined, minAge: undefined, maxAge: 17 },
            { name: 'Adulti',       gender: undefined, minAge: 18, maxAge: 59 },
            { name: 'Senior',       gender: undefined, minAge: 60, maxAge: undefined },
        ],
    },
];

// Raggruppa i preset per gruppo
export const PRESET_GROUPS = Array.from(
    new Set(CATEGORY_PRESETS.map(p => p.group))
);
