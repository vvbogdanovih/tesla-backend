// Фіксований набір наскрізних текстів сайту. Ключі стабільні (читаються сторфронтом).
// Адмін лише редагує вміст; додавання/видалення не передбачено.
export const CONTENT_BLOCKS = [
	{ key: 'warranty', title: 'Гарантія' },
	{ key: 'delivery_payment', title: 'Доставка та оплата' }
] as const

export type ContentBlockKey = (typeof CONTENT_BLOCKS)[number]['key']
