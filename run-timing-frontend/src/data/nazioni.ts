// Nazionalità: codici a 3 lettere (come World Athletics / Race Result), Italia per prima.
// Straniero = nazionalità diversa da ITA (classifica a parte, se la gara la prevede).

export const NAZIONI: { code: string; label: string }[] = [
    { code: 'ITA', label: 'Italia' },
    { code: 'ALB', label: 'Albania' }, { code: 'ALG', label: 'Algeria' }, { code: 'ARG', label: 'Argentina' },
    { code: 'AUS', label: 'Australia' }, { code: 'AUT', label: 'Austria' }, { code: 'BEL', label: 'Belgio' },
    { code: 'BIH', label: 'Bosnia ed Erzegovina' }, { code: 'BRA', label: 'Brasile' }, { code: 'BUL', label: 'Bulgaria' },
    { code: 'CAN', label: 'Canada' }, { code: 'CHI', label: 'Cile' }, { code: 'CHN', label: 'Cina' },
    { code: 'COL', label: 'Colombia' }, { code: 'CRO', label: 'Croazia' }, { code: 'CUB', label: 'Cuba' },
    { code: 'CZE', label: 'Repubblica Ceca' }, { code: 'DEN', label: 'Danimarca' }, { code: 'ECU', label: 'Ecuador' },
    { code: 'EGY', label: 'Egitto' }, { code: 'ERI', label: 'Eritrea' }, { code: 'ESP', label: 'Spagna' },
    { code: 'EST', label: 'Estonia' }, { code: 'ETH', label: 'Etiopia' }, { code: 'FIN', label: 'Finlandia' },
    { code: 'FRA', label: 'Francia' }, { code: 'GBR', label: 'Gran Bretagna' }, { code: 'GER', label: 'Germania' },
    { code: 'GRE', label: 'Grecia' }, { code: 'HUN', label: 'Ungheria' }, { code: 'IND', label: 'India' },
    { code: 'IRL', label: 'Irlanda' }, { code: 'ISR', label: 'Israele' }, { code: 'JPN', label: 'Giappone' },
    { code: 'KEN', label: 'Kenya' }, { code: 'LAT', label: 'Lettonia' }, { code: 'LTU', label: 'Lituania' },
    { code: 'LUX', label: 'Lussemburgo' }, { code: 'MAR', label: 'Marocco' }, { code: 'MDA', label: 'Moldavia' },
    { code: 'MEX', label: 'Messico' }, { code: 'MKD', label: 'Macedonia del Nord' }, { code: 'MLT', label: 'Malta' },
    { code: 'MNE', label: 'Montenegro' }, { code: 'NED', label: 'Paesi Bassi' }, { code: 'NGR', label: 'Nigeria' },
    { code: 'NOR', label: 'Norvegia' }, { code: 'NZL', label: 'Nuova Zelanda' }, { code: 'PER', label: 'Perù' },
    { code: 'POL', label: 'Polonia' }, { code: 'POR', label: 'Portogallo' }, { code: 'ROU', label: 'Romania' },
    { code: 'RSA', label: 'Sudafrica' }, { code: 'SEN', label: 'Senegal' }, { code: 'SLO', label: 'Slovenia' },
    { code: 'SMR', label: 'San Marino' }, { code: 'SRB', label: 'Serbia' }, { code: 'SUI', label: 'Svizzera' },
    { code: 'SVK', label: 'Slovacchia' }, { code: 'SWE', label: 'Svezia' }, { code: 'TUN', label: 'Tunisia' },
    { code: 'TUR', label: 'Turchia' }, { code: 'UGA', label: 'Uganda' }, { code: 'UKR', label: 'Ucraina' },
    { code: 'USA', label: 'Stati Uniti' }, { code: 'VAT', label: 'Città del Vaticano' }, { code: 'VEN', label: 'Venezuela' },
];

export const NAZIONI_OPTIONS = NAZIONI.map(n => ({ value: n.code, label: n.label }));
