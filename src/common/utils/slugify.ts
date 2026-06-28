// Транслітерація укр/рос → латиниця + нормалізація у slug.
// Латинський ввід («Model 3») проходить без змін → 'model-3'.
const TRANSLIT: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'h',
	ґ: 'g',
	д: 'd',
	е: 'e',
	є: 'ye',
	ж: 'zh',
	з: 'z',
	и: 'y',
	і: 'i',
	ї: 'yi',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ь: '',
	ю: 'yu',
	я: 'ya',
	// рос-специфічні (яких немає в укр.)
	ё: 'yo',
	ъ: '',
	ы: 'y',
	э: 'e',
	"'": '',
	'ʼ': '',
	'’': ''
}

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.split('')
		.map(ch => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
		.join('')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}
