import type { Result } from '../types';

// Results keyed by raceId — solo eventi passati (4, 5, 6)
export const mockResults: Record<string, Result[]> = {

    // Trail delle Cinque Terre — Lungo 32km
    '4-a': [
        { position: 1,  bib: '101', athleteName: 'Marco Ferretti',     category: 'M18-34', time: '3:28:14', gap: undefined },
        { position: 2,  bib: '034', athleteName: 'Luca Bianchi',       category: 'M35-49', time: '3:41:52', gap: '+13:38' },
        { position: 3,  bib: '078', athleteName: 'Davide Moretti',     category: 'M18-34', time: '3:44:09', gap: '+15:55' },
        { position: 4,  bib: '055', athleteName: 'Andrea Conti',       category: 'M35-49', time: '3:52:31', gap: '+24:17' },
        { position: 5,  bib: '112', athleteName: 'Sara Gentile',       category: 'F18-34', time: '3:58:47', gap: '+30:33' },
        { position: 6,  bib: '089', athleteName: 'Giulia Marini',      category: 'F18-34', time: '4:07:22', gap: '+39:08' },
        { position: 7,  bib: '023', athleteName: 'Roberto Esposito',   category: 'M50-59', time: '4:11:05', gap: '+42:51' },
        { position: 8,  bib: '067', athleteName: 'Stefano Ricci',      category: 'M35-49', time: '4:19:40', gap: '+51:26' },
        { position: 9,  bib: '140', athleteName: 'Martina Colombo',    category: 'F35-49', time: '4:28:13', gap: '+59:59' },
        { position: 10, bib: '095', athleteName: 'Francesco Vitale',   category: 'M60+',   time: '4:35:50', gap: '+1:07:36' },
        { position: 11, bib: '031', athleteName: 'Elena Greco',        category: 'F35-49', time: '4:44:02', gap: '+1:15:48' },
        { position: 12, bib: '158', athleteName: 'Paolo Negri',        category: 'M50-59', time: '4:58:30', gap: '+1:30:16' },
    ],

    // Trail delle Cinque Terre — Corto 18km
    '4-b': [
        { position: 1,  bib: '201', athleteName: 'Simone Barbieri',    category: 'M18-34', time: '1:32:08', gap: undefined },
        { position: 2,  bib: '215', athleteName: 'Chiara Fontana',     category: 'F18-34', time: '1:38:44', gap: '+6:36' },
        { position: 3,  bib: '248', athleteName: 'Nicola De Rosa',     category: 'M35-49', time: '1:41:17', gap: '+9:09' },
        { position: 4,  bib: '233', athleteName: 'Alessia Bruno',      category: 'F18-34', time: '1:45:33', gap: '+13:25' },
        { position: 5,  bib: '209', athleteName: 'Giorgio Mancini',    category: 'M35-49', time: '1:49:50', gap: '+17:42' },
        { position: 6,  bib: '271', athleteName: 'Valeria Caruso',     category: 'F35-49', time: '1:54:22', gap: '+22:14' },
        { position: 7,  bib: '257', athleteName: 'Antonio Palermo',    category: 'M50-59', time: '1:58:40', gap: '+26:32' },
        { position: 8,  bib: '294', athleteName: 'Federica Longo',     category: 'F35-49', time: '2:03:15', gap: '+31:07' },
        { position: 9,  bib: '222', athleteName: 'Matteo Ferrara',     category: 'M60+',   time: '2:09:58', gap: '+37:50' },
        { position: 10, bib: '308', athleteName: 'Irene Cattaneo',     category: 'F50+',   time: '2:18:44', gap: '+46:36' },
    ],

    // Maratona di Firenze — 42.195km
    '5-a': [
        { position: 1,  bib: '001', athleteName: 'Yohannes Tesfaye',   category: 'M18-34', time: '2:24:38', gap: undefined },
        { position: 2,  bib: '002', athleteName: 'Mohamed Idrissi',    category: 'M18-34', time: '2:27:11', gap: '+2:33' },
        { position: 3,  bib: '007', athleteName: 'Filippo Galli',      category: 'M18-34', time: '2:38:54', gap: '+14:16' },
        { position: 4,  bib: '015', athleteName: 'Anna Volkov',        category: 'F18-34', time: '2:51:20', gap: '+26:42' },
        { position: 5,  bib: '022', athleteName: 'Giuseppe Russo',     category: 'M35-49', time: '2:56:47', gap: '+32:09' },
        { position: 6,  bib: '038', athleteName: 'Claudia Neri',       category: 'F18-34', time: '3:04:33', gap: '+39:55' },
        { position: 7,  bib: '044', athleteName: 'Emanuele Ferrari',   category: 'M35-49', time: '3:10:08', gap: '+45:30' },
        { position: 8,  bib: '059', athleteName: 'Laura Amato',        category: 'F35-49', time: '3:18:22', gap: '+53:44' },
        { position: 9,  bib: '063', athleteName: 'Sergio Riva',        category: 'M50-59', time: '3:27:55', gap: '+1:03:17' },
        { position: 10, bib: '071', athleteName: 'Paola Fabbri',       category: 'F35-49', time: '3:35:14', gap: '+1:10:36' },
        { position: 11, bib: '084', athleteName: 'Gianni Luca',        category: 'M60+',   time: '3:48:02', gap: '+1:23:24' },
        { position: 12, bib: '099', athleteName: 'Carmen Vitello',     category: 'F50+',   time: '3:59:41', gap: '+1:35:03' },
        { position: 13, bib: '115', athleteName: 'Vincenzo Monti',     category: 'M50-59', time: '4:14:33', gap: '+1:49:55' },
        { position: 14, bib: '128', athleteName: 'Rosa Colombo',       category: 'F50+',   time: '4:32:10', gap: '+2:07:32' },
    ],

    // Maratona di Firenze — Non Competitiva 10km
    '5-b': [
        { position: 1,  bib: '501', athleteName: 'Daniele Tosi',       category: 'M18-34', time: '37:22',   gap: undefined },
        { position: 2,  bib: '512', athleteName: 'Cristina Poli',      category: 'F18-34', time: '39:48',   gap: '+2:26' },
        { position: 3,  bib: '534', athleteName: 'Marco Sala',         category: 'M35-49', time: '41:05',   gap: '+3:43' },
        { position: 4,  bib: '547', athleteName: 'Giorgia Serra',      category: 'F18-34', time: '43:31',   gap: '+6:09' },
        { position: 5,  bib: '559', athleteName: 'Renato Galli',       category: 'M50-59', time: '45:10',   gap: '+7:48' },
        { position: 6,  bib: '566', athleteName: 'Marta Benedetti',    category: 'F35-49', time: '47:55',   gap: '+10:33' },
        { position: 7,  bib: '578', athleteName: 'Claudio Rizzo',      category: 'M60+',   time: '50:22',   gap: '+13:00' },
        { position: 8,  bib: '590', athleteName: 'Silvia Gatti',       category: 'F35-49', time: '52:47',   gap: '+15:25' },
        { position: 9,  bib: '603', athleteName: 'Pietro Mazzi',       category: 'M35-49', time: '55:14',   gap: '+17:52' },
        { position: 10, bib: '618', athleteName: 'Lucia Ferretti',     category: 'F50+',   time: '58:40',   gap: '+21:18' },
    ],

    // Open Water Garda — 5km
    '6-a': [
        { position: 1,  bib: '301', athleteName: 'Alessandro Greco',   category: 'M18-34', time: '1:02:14', gap: undefined },
        { position: 2,  bib: '315', athleteName: 'Lorenzo Martini',    category: 'M18-34', time: '1:04:48', gap: '+2:34' },
        { position: 3,  bib: '328', athleteName: 'Sofia Bernardi',     category: 'F18-34', time: '1:08:33', gap: '+6:19' },
        { position: 4,  bib: '342', athleteName: 'Fabio Costantini',   category: 'M35-49', time: '1:12:07', gap: '+9:53' },
        { position: 5,  bib: '356', athleteName: 'Elisa Pinto',        category: 'F18-34', time: '1:15:40', gap: '+13:26' },
        { position: 6,  bib: '369', athleteName: 'Massimo Orlando',    category: 'M50-59', time: '1:19:22', gap: '+17:08' },
        { position: 7,  bib: '374', athleteName: 'Beatrice Morano',    category: 'F35-49', time: '1:24:55', gap: '+22:41' },
        { position: 8,  bib: '388', athleteName: 'Carlo Pio',          category: 'M60+',   time: '1:31:10', gap: '+28:56' },
    ],

    // Open Water Garda — 3km
    '6-b': [
        { position: 1,  bib: '401', athleteName: 'Tommaso Vinci',      category: 'M18-34', time: '36:42',   gap: undefined },
        { position: 2,  bib: '418', athleteName: 'Francesca Sala',     category: 'F18-34', time: '38:55',   gap: '+2:13' },
        { position: 3,  bib: '432', athleteName: 'Mattia Parisi',      category: 'M35-49', time: '40:10',   gap: '+3:28' },
        { position: 4,  bib: '447', athleteName: 'Serena Grasso',      category: 'F35-49', time: '42:38',   gap: '+5:56' },
        { position: 5,  bib: '461', athleteName: 'Umberto Calabrese',  category: 'M50-59', time: '44:51',   gap: '+8:09' },
        { position: 6,  bib: '475', athleteName: 'Noemi Farina',       category: 'F18-34', time: '47:22',   gap: '+10:40' },
        { position: 7,  bib: '489', athleteName: 'Salvatore Leone',    category: 'M60+',   time: '51:08',   gap: '+14:26' },
    ],

    // Open Water Garda — 1.5km
    '6-c': [
        { position: 1,  bib: '701', athleteName: 'Luca Vitale',        category: 'M18-34', time: '17:33',   gap: undefined },
        { position: 2,  bib: '714', athleteName: 'Greta Marini',       category: 'F18-34', time: '18:10',   gap: '+0:37' },
        { position: 3,  bib: '728', athleteName: 'Dario Lombardi',     category: 'M35-49', time: '18:55',   gap: '+1:22' },
        { position: 4,  bib: '742', athleteName: 'Camilla Perna',      category: 'F18-34', time: '19:40',   gap: '+2:07' },
        { position: 5,  bib: '757', athleteName: 'Enrico Rizzi',       category: 'M50-59', time: '20:28',   gap: '+2:55' },
        { position: 6,  bib: '769', athleteName: 'Roberta Gentili',    category: 'F35-49', time: '21:14',   gap: '+3:41' },
        { position: 7,  bib: '783', athleteName: 'Pasquale Greco',     category: 'M60+',   time: '22:50',   gap: '+5:17' },
        { position: 8,  bib: '796', athleteName: 'Aurora Costa',       category: 'F50+',   time: '24:05',   gap: '+6:32' },
    ],
};
