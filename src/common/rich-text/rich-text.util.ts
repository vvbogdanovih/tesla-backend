import { generateHTML } from '@tiptap/html/server'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import sanitizeHtml from 'sanitize-html'

// Набір extensions має збігатися з редактором адмінки (RichTextEditor).
const extensions = [StarterKit]

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'u',
		's',
		'h1',
		'h2',
		'h3',
		'h4',
		'ul',
		'ol',
		'li',
		'blockquote',
		'code',
		'pre',
		'a',
		'img',
		'hr'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		img: ['src', 'alt']
	},
	allowedSchemes: ['http', 'https', 'mailto']
}

/**
 * TipTap JSON → санітизований HTML (для сторфронту). Джерело правди — JSON;
 * HTML генерується на бекенді при кожному збереженні (ADR-0006).
 */
export function richTextToHtml(doc: JSONContent | null | undefined): string {
	if (!doc || typeof doc !== 'object') return ''
	const html = generateHTML(doc, extensions)
	return sanitizeHtml(html, SANITIZE_OPTIONS)
}
