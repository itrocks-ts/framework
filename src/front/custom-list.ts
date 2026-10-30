
type CustomListBrowser = typeof import('@itrocks/custom-list/custom-list.js')

const pending = new WeakMap<HTMLElement, () => Promise<void>>()
let integration: Promise<CustomListBrowser> | undefined

export function enhanceListBreadcrumb(heading: HTMLHeadingElement): boolean
{
	const article = heading.closest<HTMLElement>('main > article[data-route]')
	if (!article || (article.dataset.action !== 'list' && !/\/[0-9,]+$/.test(article.dataset.route!))) return false
	const breadcrumb = document.querySelector('ol.breadcrumb')
	const template   = article.querySelector<HTMLTemplateElement>('template[data-list-breadcrumb]')
	const rendered   = !!template && !!breadcrumb
	if (rendered) {
		for (const entry of breadcrumb.querySelectorAll(
			'li[data-action=list], li[data-action=custom-list], li[data-action=view]'
		)) {
			entry.remove()
		}
		breadcrumb.append(template.content.cloneNode(true))
		template.remove()
	}
	void (integration ??= import('@itrocks/custom-list/custom-list.js').then(customList => {
		customList.customListBrowserDependsOn({ settled: article => pending.get(article)?.() ?? Promise.resolve() })
		return customList
	})).then(customList => {
		if (heading.isConnected) return customList.updateListBreadcrumb(heading, rendered)
	})
	return rendered
}

document.addEventListener('itrocks:list-change', event => {
	const article = (event.target as HTMLElement).closest<HTMLElement>('article')
	if (!article) return
	void integration?.then(customList => customList.markListModified(article.dataset.route!))
})

document.addEventListener('itrocks:list-ready', event => {
	const article = (event.target as HTMLElement).closest<HTMLElement>('article')
	if (!article) return
	pending.set(article, (event as CustomEvent<{ settled: () => Promise<void> }>).detail.settled)
})
