import type { Result, RaceClassification } from '../types';

// ─── Risultati per raceId ───────────────────────────────────────────────────

export const mockResults: Record<string, Result[]> = {

    // Trail delle Cinque Terre — Lungo 32km
    '4-a': [
        { position: 1,  bib: '101', athleteName: 'Marco Ferretti',    category: 'M18-34', team: 'ASD Liguria Trail',    time: '3:28:14', status: 'finisher' },
        { position: 2,  bib: '034', athleteName: 'Luca Bianchi',      category: 'M35-49', team: 'Team Monti',           time: '3:41:52', gap: '+13:38',   status: 'finisher' },
        { position: 3,  bib: '078', athleteName: 'Davide Moretti',    category: 'M18-34', team: 'ASD Liguria Trail',    time: '3:44:09', gap: '+15:55',   status: 'finisher' },
        { position: 4,  bib: '055', athleteName: 'Andrea Conti',      category: 'M35-49', team: 'Polisportiva Spezia',  time: '3:52:31', gap: '+24:17',   status: 'finisher' },
        { position: 5,  bib: '112', athleteName: 'Sara Gentile',      category: 'F18-34', team: 'Team Monti',           time: '3:58:47', gap: '+30:33',   status: 'finisher' },
        { position: 6,  bib: '089', athleteName: 'Giulia Marini',     category: 'F18-34', team: 'ASD Liguria Trail',    time: '4:07:22', gap: '+39:08',   status: 'finisher' },
        { position: 7,  bib: '023', athleteName: 'Roberto Esposito',  category: 'M50-59', team: 'Polisportiva Spezia',  time: '4:11:05', gap: '+42:51',   status: 'finisher' },
        { position: 8,  bib: '067', athleteName: 'Stefano Ricci',     category: 'M35-49', team: 'Team Monti',           time: '4:19:40', gap: '+51:26',   status: 'finisher' },
        { position: 9,  bib: '140', athleteName: 'Martina Colombo',   category: 'F35-49', team: 'ASD Liguria Trail',    time: '4:28:13', gap: '+59:59',   status: 'finisher' },
        { position: 10, bib: '095', athleteName: 'Francesco Vitale',  category: 'M60+',   team: 'Polisportiva Spezia',  time: '4:35:50', gap: '+1:07:36', status: 'finisher' },
        { position: 11, bib: '031', athleteName: 'Elena Greco',       category: 'F35-49', team: 'Team Monti',           time: '4:44:02', gap: '+1:15:48', status: 'finisher' },
        { position: 12, bib: '158', athleteName: 'Paolo Negri',       category: 'M50-59', team: 'ASD Liguria Trail',    time: '4:58:30', gap: '+1:30:16', status: 'finisher' },
        { position: 13, bib: '044', athleteName: 'Giorgio Sanna',     category: 'M18-34', team: 'Team Monti',           time: 'DNF',     status: 'dnf' },
        { position: 14, bib: '072', athleteName: 'Carla Russo',       category: 'F50+',   team: 'ASD Liguria Trail',    time: 'DNS',     status: 'dns' },
    ],

    // Trail delle Cinque Terre — Corto 18km
    '4-b': [
        { position: 1,  bib: '201', athleteName: 'Simone Barbieri',   category: 'M18-34', team: 'ASD Liguria Trail',    time: '1:32:08', status: 'finisher' },
        { position: 2,  bib: '215', athleteName: 'Chiara Fontana',    category: 'F18-34', team: 'Team Monti',           time: '1:38:44', gap: '+6:36',  status: 'finisher' },
        { position: 3,  bib: '248', athleteName: 'Nicola De Rosa',    category: 'M35-49', team: 'Polisportiva Spezia',  time: '1:41:17', gap: '+9:09',  status: 'finisher' },
        { position: 4,  bib: '233', athleteName: 'Alessia Bruno',     category: 'F18-34', team: 'ASD Liguria Trail',    time: '1:45:33', gap: '+13:25', status: 'finisher' },
        { position: 5,  bib: '209', athleteName: 'Giorgio Mancini',   category: 'M35-49', team: 'Team Monti',           time: '1:49:50', gap: '+17:42', status: 'finisher' },
        { position: 6,  bib: '271', athleteName: 'Valeria Caruso',    category: 'F35-49', team: 'Polisportiva Spezia',  time: '1:54:22', gap: '+22:14', status: 'finisher' },
        { position: 7,  bib: '257', athleteName: 'Antonio Palermo',   category: 'M50-59', team: 'ASD Liguria Trail',    time: '1:58:40', gap: '+26:32', status: 'finisher' },
        { position: 8,  bib: '294', athleteName: 'Federica Longo',    category: 'F35-49', team: 'Team Monti',           time: '2:03:15', gap: '+31:07', status: 'finisher' },
        { position: 9,  bib: '222', athleteName: 'Matteo Ferrara',    category: 'M60+',   team: 'ASD Liguria Trail',    time: '2:09:58', gap: '+37:50', status: 'finisher' },
        { position: 10, bib: '308', athleteName: 'Irene Cattaneo',    category: 'F50+',   team: 'Polisportiva Spezia',  time: '2:18:44', gap: '+46:36', status: 'finisher' },
        { position: 11, bib: '319', athleteName: 'Bruno Gatti',       category: 'M35-49', team: 'Team Monti',           time: 'DSQ',     status: 'dsq' },
    ],

    // Maratona di Firenze — 42.195km
    '5-a': [
        { position: 1,  bib: '001', athleteName: 'Yohannes Tesfaye',  category: 'M18-34', team: 'Firenze Athletic',    time: '2:24:38', status: 'finisher' },
        { position: 2,  bib: '002', athleteName: 'Mohamed Idrissi',   category: 'M18-34', team: 'Firenze Athletic',    time: '2:27:11', gap: '+2:33',    status: 'finisher' },
        { position: 3,  bib: '007', athleteName: 'Filippo Galli',     category: 'M18-34', team: 'GS Toscana',         time: '2:38:54', gap: '+14:16',   status: 'finisher' },
        { position: 4,  bib: '015', athleteName: 'Anna Volkov',       category: 'F18-34', team: 'Firenze Athletic',   time: '2:51:20', gap: '+26:42',   status: 'finisher' },
        { position: 5,  bib: '022', athleteName: 'Giuseppe Russo',    category: 'M35-49', team: 'GS Toscana',         time: '2:56:47', gap: '+32:09',   status: 'finisher' },
        { position: 6,  bib: '038', athleteName: 'Claudia Neri',      category: 'F18-34', team: 'ASD Arno Run',       time: '3:04:33', gap: '+39:55',   status: 'finisher' },
        { position: 7,  bib: '044', athleteName: 'Emanuele Ferrari',  category: 'M35-49', team: 'GS Toscana',         time: '3:10:08', gap: '+45:30',   status: 'finisher' },
        { position: 8,  bib: '059', athleteName: 'Laura Amato',       category: 'F35-49', team: 'ASD Arno Run',       time: '3:18:22', gap: '+53:44',   status: 'finisher' },
        { position: 9,  bib: '063', athleteName: 'Sergio Riva',       category: 'M50-59', team: 'Firenze Athletic',   time: '3:27:55', gap: '+1:03:17', status: 'finisher' },
        { position: 10, bib: '071', athleteName: 'Paola Fabbri',      category: 'F35-49', team: 'GS Toscana',         time: '3:35:14', gap: '+1:10:36', status: 'finisher' },
        { position: 11, bib: '084', athleteName: 'Gianni Luca',       category: 'M60+',   team: 'ASD Arno Run',       time: '3:48:02', gap: '+1:23:24', status: 'finisher' },
        { position: 12, bib: '099', athleteName: 'Carmen Vitello',    category: 'F50+',   team: 'Firenze Athletic',   time: '3:59:41', gap: '+1:35:03', status: 'finisher' },
        { position: 13, bib: '115', athleteName: 'Vincenzo Monti',    category: 'M50-59', team: 'GS Toscana',         time: '4:14:33', gap: '+1:49:55', status: 'finisher' },
        { position: 14, bib: '128', athleteName: 'Rosa Colombo',      category: 'F50+',   team: 'ASD Arno Run',       time: '4:32:10', gap: '+2:07:32', status: 'finisher' },
        { position: 15, bib: '133', athleteName: 'Carlo Bruni',       category: 'M35-49', team: 'Firenze Athletic',   time: 'DNF',     status: 'dnf' },
    ],

    // Maratona di Firenze — Non Competitiva 10km
    '5-b': [
        { position: 1,  bib: '501', athleteName: 'Daniele Tosi',      category: 'M18-34', time: '37:22', status: 'finisher' },
        { position: 2,  bib: '512', athleteName: 'Cristina Poli',     category: 'F18-34', time: '39:48', gap: '+2:26',  status: 'finisher' },
        { position: 3,  bib: '534', athleteName: 'Marco Sala',        category: 'M35-49', time: '41:05', gap: '+3:43',  status: 'finisher' },
        { position: 4,  bib: '547', athleteName: 'Giorgia Serra',     category: 'F18-34', time: '43:31', gap: '+6:09',  status: 'finisher' },
        { position: 5,  bib: '559', athleteName: 'Renato Galli',      category: 'M50-59', time: '45:10', gap: '+7:48',  status: 'finisher' },
        { position: 6,  bib: '566', athleteName: 'Marta Benedetti',   category: 'F35-49', time: '47:55', gap: '+10:33', status: 'finisher' },
        { position: 7,  bib: '578', athleteName: 'Claudio Rizzo',     category: 'M60+',   time: '50:22', gap: '+13:00', status: 'finisher' },
        { position: 8,  bib: '590', athleteName: 'Silvia Gatti',      category: 'F35-49', time: '52:47', gap: '+15:25', status: 'finisher' },
        { position: 9,  bib: '603', athleteName: 'Pietro Mazzi',      category: 'M35-49', time: '55:14', gap: '+17:52', status: 'finisher' },
        { position: 10, bib: '618', athleteName: 'Lucia Ferretti',    category: 'F50+',   time: '58:40', gap: '+21:18', status: 'finisher' },
    ],

    // Open Water Garda — 5km
    '6-a': [
        { position: 1,  bib: '301', athleteName: 'Alessandro Greco',  category: 'M18-34', time: '1:02:14', status: 'finisher' },
        { position: 2,  bib: '315', athleteName: 'Lorenzo Martini',   category: 'M18-34', time: '1:04:48', gap: '+2:34',  status: 'finisher' },
        { position: 3,  bib: '328', athleteName: 'Sofia Bernardi',    category: 'F18-34', time: '1:08:33', gap: '+6:19',  status: 'finisher' },
        { position: 4,  bib: '342', athleteName: 'Fabio Costantini',  category: 'M35-49', time: '1:12:07', gap: '+9:53',  status: 'finisher' },
        { position: 5,  bib: '356', athleteName: 'Elisa Pinto',       category: 'F18-34', time: '1:15:40', gap: '+13:26', status: 'finisher' },
        { position: 6,  bib: '369', athleteName: 'Massimo Orlando',   category: 'M50-59', time: '1:19:22', gap: '+17:08', status: 'finisher' },
        { position: 7,  bib: '374', athleteName: 'Beatrice Morano',   category: 'F35-49', time: '1:24:55', gap: '+22:41', status: 'finisher' },
        { position: 8,  bib: '388', athleteName: 'Carlo Pio',         category: 'M60+',   time: '1:31:10', gap: '+28:56', status: 'finisher' },
    ],

    // Open Water Garda — 3km
    '6-b': [
        { position: 1,  bib: '401', athleteName: 'Tommaso Vinci',     category: 'M18-34', time: '36:42', status: 'finisher' },
        { position: 2,  bib: '418', athleteName: 'Francesca Sala',    category: 'F18-34', time: '38:55', gap: '+2:13', status: 'finisher' },
        { position: 3,  bib: '432', athleteName: 'Mattia Parisi',     category: 'M35-49', time: '40:10', gap: '+3:28', status: 'finisher' },
        { position: 4,  bib: '447', athleteName: 'Serena Grasso',     category: 'F35-49', time: '42:38', gap: '+5:56', status: 'finisher' },
        { position: 5,  bib: '461', athleteName: 'Umberto Calabrese', category: 'M50-59', time: '44:51', gap: '+8:09', status: 'finisher' },
        { position: 6,  bib: '475', athleteName: 'Noemi Farina',      category: 'F18-34', time: '47:22', gap: '+10:40', status: 'finisher' },
        { position: 7,  bib: '489', athleteName: 'Salvatore Leone',   category: 'M60+',   time: '51:08', gap: '+14:26', status: 'finisher' },
    ],

    // Open Water Garda — 1.5km
    '6-c': [
        { position: 1,  bib: '701', athleteName: 'Luca Vitale',       category: 'M18-34', time: '17:33', status: 'finisher' },
        { position: 2,  bib: '714', athleteName: 'Greta Marini',      category: 'F18-34', time: '18:10', gap: '+0:37', status: 'finisher' },
        { position: 3,  bib: '728', athleteName: 'Dario Lombardi',    category: 'M35-49', time: '18:55', gap: '+1:22', status: 'finisher' },
        { position: 4,  bib: '742', athleteName: 'Camilla Perna',     category: 'F18-34', time: '19:40', gap: '+2:07', status: 'finisher' },
        { position: 5,  bib: '757', athleteName: 'Enrico Rizzi',      category: 'M50-59', time: '20:28', gap: '+2:55', status: 'finisher' },
        { position: 6,  bib: '769', athleteName: 'Roberta Gentili',   category: 'F35-49', time: '21:14', gap: '+3:41', status: 'finisher' },
        { position: 7,  bib: '783', athleteName: 'Pasquale Greco',    category: 'M60+',   time: '22:50', gap: '+5:17', status: 'finisher' },
        { position: 8,  bib: '796', athleteName: 'Aurora Costa',      category: 'F50+',   time: '24:05', gap: '+6:32', status: 'finisher' },
    ],

    // Criterium di Torino — Elite 30 giri (laps_fixed)
    '7-a': [
        {
            position: 1, bib: '11', athleteName: 'Riccardo Ventura',  category: 'M18-34', team: 'Team Piemonte',
            time: '1:52:14', status: 'finisher', lapsCompleted: 30,
            lapSplits: [
                { lap: 1,  split: '3:42', cum: '3:42' },
                { lap: 2,  split: '3:45', cum: '7:27' },
                { lap: 3,  split: '3:44', cum: '11:11' },
                { lap: 5,  split: '3:46', cum: '18:44' },
                { lap: 10, split: '3:48', cum: '37:30' },
                { lap: 20, split: '3:51', cum: '1:16:02' },
                { lap: 30, split: '3:47', cum: '1:52:14' },
            ],
        },
        {
            position: 2, bib: '07', athleteName: 'Diego Martello',    category: 'M18-34', team: 'Velo Torino',
            time: '1:52:41', gap: '+0:27', status: 'finisher', lapsCompleted: 30,
            lapSplits: [
                { lap: 1,  split: '3:42', cum: '3:42' },
                { lap: 10, split: '3:49', cum: '37:35' },
                { lap: 20, split: '3:52', cum: '1:16:28' },
                { lap: 30, split: '3:48', cum: '1:52:41' },
            ],
        },
        {
            position: 3, bib: '23', athleteName: 'Alberto Ferri',     category: 'M35-49', team: 'Team Piemonte',
            time: '1:53:09', gap: '+0:55', status: 'finisher', lapsCompleted: 30,
        },
        { position: 4,  bib: '31', athleteName: 'Gian Rossi',        category: 'M18-34', team: 'Velo Torino',   time: '1:53:58', gap: '+1:44', status: 'finisher', lapsCompleted: 30 },
        { position: 5,  bib: '45', athleteName: 'Marco Vitali',      category: 'M35-49', team: 'GS Piemonte',   time: '1:54:22', gap: '+2:08', status: 'finisher', lapsCompleted: 30 },
        { position: 6,  bib: '52', athleteName: 'Simone Barra',      category: 'M18-34', team: 'Velo Torino',   time: '1:55:11', gap: '+2:57', status: 'finisher', lapsCompleted: 30 },
        { position: 7,  bib: '18', athleteName: 'Luca Asti',         category: 'M50-59', team: 'GS Piemonte',   time: '1:56:45', gap: '+4:31', status: 'finisher', lapsCompleted: 30 },
        { position: 8,  bib: '39', athleteName: 'Fabio Cuneo',       category: 'M35-49', team: 'Team Piemonte', time: '1:58:30', gap: '+6:16', status: 'finisher', lapsCompleted: 30 },
        { position: 9,  bib: '64', athleteName: 'Davide Saluzzo',    category: 'M18-34', team: 'GS Piemonte',   time: '2:01:02', gap: '+8:48', status: 'finisher', lapsCompleted: 29 },
        { position: 10, bib: '27', athleteName: 'Pietro Novara',     category: 'M60+',   team: 'Velo Torino',   time: 'DNF',     status: 'dnf', lapsCompleted: 14 },
    ],

    // Criterium di Torino — Granfondo 1h (laps_timed)
    '7-b': [
        { position: 1,  bib: '101', athleteName: 'Carlo Biella',      category: 'M18-34', team: 'Velo Torino',   time: '1:00:00', status: 'finisher', lapsCompleted: 19 },
        { position: 2,  bib: '115', athleteName: 'Franco Pinerolo',   category: 'M35-49', team: 'GS Piemonte',   time: '1:00:00', status: 'finisher', lapsCompleted: 18 },
        { position: 3,  bib: '128', athleteName: 'Lucia Ivrea',       category: 'F18-34', team: 'Team Piemonte', time: '1:00:00', status: 'finisher', lapsCompleted: 18 },
        { position: 4,  bib: '140', athleteName: 'Roberto Vercelli',  category: 'M50-59', team: 'Velo Torino',   time: '1:00:00', status: 'finisher', lapsCompleted: 17 },
        { position: 5,  bib: '152', athleteName: 'Silvia Chieri',     category: 'F35-49', team: 'GS Piemonte',   time: '1:00:00', status: 'finisher', lapsCompleted: 17 },
        { position: 6,  bib: '167', athleteName: 'Marco Moncalieri',  category: 'M35-49', team: 'Team Piemonte', time: '1:00:00', status: 'finisher', lapsCompleted: 16 },
        { position: 7,  bib: '179', athleteName: 'Anna Asti',         category: 'F18-34', team: 'Velo Torino',   time: '1:00:00', status: 'finisher', lapsCompleted: 16 },
        { position: 8,  bib: '183', athleteName: 'Enzo Cuorgnè',      category: 'M60+',   team: 'GS Piemonte',   time: '1:00:00', status: 'finisher', lapsCompleted: 15 },
    ],
};

// ─── Classifiche speciali per gara ─────────────────────────────────────────

export const raceClassifications: Record<string, RaceClassification> = {
    '4-a': {
        raceId: '4-a',
        specials: [
            { label: 'Prima donna assoluta', result: mockResults['4-a'][4] },
            { label: 'Primo M60+',           result: mockResults['4-a'][9] },
            { label: 'Primo atleta locale (ASD Liguria Trail)', result: mockResults['4-a'][0] },
        ],
    },
    '5-a': {
        raceId: '5-a',
        specials: [
            { label: 'Prima donna assoluta', result: mockResults['5-a'][3] },
            { label: 'Primo master M35+',    result: mockResults['5-a'][4] },
            { label: 'Primo M50+',           result: mockResults['5-a'][8] },
            { label: 'Prima F35+',           result: mockResults['5-a'][7] },
        ],
    },
    '7-a': {
        raceId: '7-a',
        specials: [
            { label: 'Primo M35+',  result: mockResults['7-a'][2] },
            { label: 'Primo M50+',  result: mockResults['7-a'][6] },
            { label: 'Miglior giro (bib 11)', result: { ...mockResults['7-a'][0], time: '3:42' } },
        ],
    },
};
