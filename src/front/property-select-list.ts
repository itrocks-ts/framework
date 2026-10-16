import { loadCss }                  from '@itrocks/asset-loader/asset-loader.js'
import type { ListPropertySelect }  from '@itrocks/list/property-select.js'
import type { ListSelectorOptions } from '@itrocks/list/property-select.js'
import { HttpMetadataProvider }     from './property-select-metadata.js'

export type PaneRegistration = (
	owner: object, content: HTMLElement, title: string
) => ReturnType<ListSelectorOptions['mountSelector']>

type Entry = { article: HTMLElement; options: Omit<ListSelectorOptions, 'metadata' | 'mountSelector'> }
const waiting = new Map<HTMLElement, Entry>()
const mounted = new Map<HTMLElement, ListPropertySelect>()
let register: PaneRegistration | undefined

async function activate(entry: Entry): Promise<void>
{
	if (!register || !entry.article.isConnected || mounted.has(entry.article)) return
	const { ListPropertySelect } = await import('@itrocks/list/property-select.js')
	if (!register || !entry.article.isConnected || mounted.has(entry.article)) return
	loadCss('/@itrocks/property-select/front/property-select.css')
	loadCss('/@itrocks/table/column-add.css')
	let integration: ListPropertySelect | undefined
	try {
		integration = new ListPropertySelect(entry.article, {
			...entry.options, metadata: new HttpMetadataProvider(), templateUrl: '/property-select/template/html',
			mountSelector: (content, title) => register!(entry.article, content, title)
		})
		mounted.set(entry.article, integration)
		waiting.delete(entry.article)
		await integration.mount()
	}
	catch (error) {
		integration?.dispose()
		mounted.delete(entry.article)
		entry.article.dispatchEvent(new CustomEvent('itrocks:list-selector-error', { bubbles: true, detail: error }))
	}
}

export function bindListPane(registration: PaneRegistration): void
{
	register = registration
	for (const entry of waiting.values()) void activate(entry)
}

document.addEventListener('itrocks:right-pane-ready', event => {
	bindListPane((event as CustomEvent<{ register: PaneRegistration }>).detail.register)
})
document.dispatchEvent(new Event('itrocks:right-pane-request'))

document.addEventListener('itrocks:list-ready', event => {
	const article = (event.target as HTMLElement).closest<HTMLElement>('article[data-property-root]')
	if (!article?.dataset.propertyRoot) return
	const entry = { article, options: (event as CustomEvent<Entry['options']>).detail }
	waiting.set(article, entry)
	void activate(entry)
})

new MutationObserver(() => {
	for (const [article, integration] of mounted) {
		if (article.isConnected) continue
		integration.dispose()
		mounted.delete(article)
	}
	for (const article of waiting.keys()) if (!article.isConnected) waiting.delete(article)
}).observe(document.body, { childList: true, subtree: true })
