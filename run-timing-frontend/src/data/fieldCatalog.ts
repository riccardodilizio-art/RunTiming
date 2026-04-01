import type { FieldType, FieldOption, CatalogKey } from '../types';

export interface CatalogEntry {
    catalogKey: CatalogKey;
    type: FieldType;
    label: string;
    placeholder?: string;
    options?: FieldOption[];
    helperText?: string;
    readOnly?: boolean;
    defaultRequired: boolean;
}

export interface CatalogGroup {
    key: string;
    label: string;
    fields: CatalogEntry[];
}

const optSesso: FieldOption[] = [
    { value: 'M', label: 'Maschile' },
    { value: 'F', label: 'Femminile' },
    { value: 'NS', label: 'Non specificato' },
];

const optCert: FieldOption[] = [
    { value: 'agonistico', label: 'Agonistico' },
    { value: 'non_agonistico', label: 'Non agonistico' },
];

const optSangue: FieldOption[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map(v => ({ value: v, label: v }));

const optMaglia: FieldOption[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(v => ({ value: v, label: v }));

export const CATALOG_GROUPS: CatalogGroup[] = [
    {
        key: 'anagrafica',
        label: 'Anagrafica',
        fields: [
            { catalogKey: 'nome',          type: 'text',   label: 'Nome',                defaultRequired: true },
            { catalogKey: 'cognome',       type: 'text',   label: 'Cognome',             defaultRequired: true },
            { catalogKey: 'data_nascita',  type: 'date',   label: 'Data di nascita',     defaultRequired: true },
            { catalogKey: 'anno_nascita',  type: 'number', label: 'Anno di nascita',     defaultRequired: false, readOnly: true, helperText: 'Calcolato automaticamente da "Data di nascita"' },
            { catalogKey: 'sesso',         type: 'select', label: 'Sesso',               defaultRequired: true, options: optSesso },
            { catalogKey: 'email',         type: 'email',  label: 'Email',               defaultRequired: true },
            { catalogKey: 'telefono',      type: 'tel',    label: 'Telefono',            defaultRequired: false },
        ],
    },
    {
        key: 'affiliazione',
        label: 'Società e Tessere',
        fields: [
            { catalogKey: 'societa',         type: 'text', label: 'Società sportiva',  defaultRequired: false },
            { catalogKey: 'codice_societa',  type: 'text', label: 'Codice società',    defaultRequired: false },
            { catalogKey: 'tessera_fidal',   type: 'text', label: 'Tessera FIDAL',     defaultRequired: false },
            { catalogKey: 'tessera_runcard', type: 'text', label: 'RunCard',           defaultRequired: false },
            { catalogKey: 'tessera_fci',     type: 'text', label: 'Tessera FCI',       defaultRequired: false },
            { catalogKey: 'tessera_csi',     type: 'text', label: 'Tessera CSI',       defaultRequired: false },
            { catalogKey: 'tessera_uisp',    type: 'text', label: 'Tessera UISP',      defaultRequired: false },
            { catalogKey: 'tessera_fitri',   type: 'text', label: 'Tessera FITRI',     defaultRequired: false },
            { catalogKey: 'tessera_fin',     type: 'text', label: 'Tessera FIN',       defaultRequired: false },
        ],
    },
    {
        key: 'certificato',
        label: 'Certificato medico',
        fields: [
            { catalogKey: 'tipo_certificato',     type: 'select', label: 'Tipo certificato',     defaultRequired: false, options: optCert },
            { catalogKey: 'num_certificato',      type: 'text',   label: 'N° certificato',        defaultRequired: false },
            { catalogKey: 'scadenza_certificato', type: 'date',   label: 'Scadenza certificato',  defaultRequired: false },
            { catalogKey: 'gruppo_sanguigno',     type: 'select', label: 'Gruppo sanguigno',      defaultRequired: false, options: optSangue },
            {
                catalogKey: 'upload_cert_medico',
                type: 'file',
                label: 'Carica certificato medico (PDF/JPG)',
                defaultRequired: false,
                helperText: 'Formati accettati: PDF, JPG, PNG. Max 5 MB.',
            },
            {
                catalogKey: 'upload_tessera',
                type: 'file',
                label: 'Carica tessera sportiva (fronte/retro)',
                defaultRequired: false,
                helperText: 'Formati accettati: PDF, JPG, PNG. Max 5 MB.',
            },
        ],
    },
    {
        key: 'extra',
        label: 'Extra',
        fields: [
            { catalogKey: 'taglia_maglia', type: 'select',   label: 'Taglia t-shirt',                   defaultRequired: false, options: optMaglia },
            { catalogKey: 'note',          type: 'textarea', label: 'Note / allergie / esigenze speciali', defaultRequired: false },
        ],
    },
    {
        key: 'consensi',
        label: 'Consensi',
        fields: [
            { catalogKey: 'privacy',     type: 'checkbox', label: 'Accetto il trattamento dei dati personali (GDPR)',  defaultRequired: true },
            { catalogKey: 'regolamento', type: 'checkbox', label: 'Ho letto e accetto il regolamento della gara',       defaultRequired: true },
            { catalogKey: 'liberatoria', type: 'checkbox', label: 'Firmo la liberatoria di responsabilità',             defaultRequired: true },
            { catalogKey: 'marketing',   type: 'checkbox', label: 'Accetto di ricevere comunicazioni promozionali',      defaultRequired: false },
        ],
    },
];

// Flat lookup map
export const CATALOG_MAP = Object.fromEntries(
    CATALOG_GROUPS.flatMap(g => g.fields.map(f => [f.catalogKey, f]))
) as Record<CatalogKey, CatalogEntry>;
