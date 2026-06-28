// Стаб rich-text для e2e: уникаємо завантаження happy-dom (ESM) у jest.
// Генерацію HTML із TipTap JSON покрито в unit-тестах.
export function richTextToHtml(doc: unknown): string {
	return doc ? '<p>html</p>' : ''
}
