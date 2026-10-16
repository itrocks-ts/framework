import assert from 'node:assert/strict'

if (!process.env.PS_PLAYWRIGHT_MODULE) throw new Error('Set PS_PLAYWRIGHT_MODULE to an installed Playwright module')
const { chromium } = await import(process.env.PS_PLAYWRIGHT_MODULE)
const origin = process.env.PS_METADATA_URL ?? 'http://127.0.0.1:13619'
let browser
try {
	browser = await chromium.launch({ chromiumSandbox: true, headless: true })
	const page = await browser.newPage()
	const errors = []
	const requests = []
	const failures = []
	page.on('requestfailed', request => failures.push({ error: request.failure()?.errorText, url: request.url() }))
	page.on('pageerror', error => errors.push(error.message))
	page.on('response', response => {
		if (response.url().includes('/property-select/')) requests.push({ status: response.status(), url: response.url() })
	})
	await page.goto(origin + '/country?offset=0')
	assert.match(await page.locator('body').innerText(), /Recipe France/)
	assert.equal(await page.locator('article[data-property-root]').getAttribute('data-property-root'), '/country')
	const observed = await page.evaluate(async () => {
		const rootId = '/metadata-invoice'
		const { HttpMetadataProvider } = await import('/@itrocks/framework/property-select-metadata.js')
		const { PropertySelect } = await import('/@itrocks/property-select/property-select.js')
		const provider = new HttpMetadataProvider()
		const context = await provider.context(rootId, '')
		const root = await provider.resolve(rootId, '')
		const deep = await provider.resolve(rootId, 'billing.city.name')
		const tags = await provider.resolve(rootId, 'tags')
		const reverse = await provider.resolve(rootId, 'tags.invoices')
		const cycle = await provider.resolve(rootId, 'tags.invoices.tags.label')
		const configuration = await provider.configuration(rootId)
		const otherClass = await provider.context('/metadata-line', '')
		const status = async (operation, root, path, extra = '') => {
			const response = await fetch(`/property-select/${operation}/json?` + new URLSearchParams({ path, root }) + extra)
			return { cache: response.headers.get('Cache-Control'), status: response.status, value: await response.json() }
		}
		const forbidden = await status('resolve', rootId, 'hidden')
		const forbiddenAncestor = await status('resolve', rootId, 'billing.city.name', '&catalogue=restricted')
		const restricted = await status('context', rootId, '', '&catalogue=restricted')
		const restrictedAdvice = await status('configuration', rootId, '', '&catalogue=restricted')
		const absentRoot = await status('context', 'absent', '')
		const actionRoot = await status('context', '/property-select/template', '')
		const ambiguous = await status('resolve', rootId, 'ambiguous.name')
		const malformed = await status('resolve', rootId, 'billing..city')
		const terminal = await status('context', rootId, 'number')
		const method = await fetch('/property-select/context/json?root=%2Fmetadata-invoice', { method: 'POST' })
		const cancel = new AbortController()
		const cancellable = new HttpMetadataProvider({ fetch: (input, options) => {
			const url = new URL(input, location.href)
			url.searchParams.set('delay', '180')
			return fetch(url, options)
		} })
		const pending = cancellable.context(rootId, 'billing', cancel.signal)
		await new Promise(resolve => setTimeout(resolve, 30))
		cancel.abort()
		let aborted = false
		try { await pending }
		catch (error) { aborted = error.name === 'AbortError' }
		let started
		const entered = new Promise(resolve => { started = resolve })
		const delayed = new HttpMetadataProvider({ fetch: async (input, options) => {
			const url = new URL(input, location.href)
			if (url.searchParams.get('path') === 'billing') {
				url.searchParams.set('delay', '140')
				started()
			}
			// The real network completes despite client cancellation, exercising late-result rejection.
			return fetch(url, { ...options, signal: undefined })
		} })
		const selector = new PropertySelect({ metadata: delayed, root: rootId })
		await selector.mount()
		const old = selector.navigate('billing')
		await entered
		const newer = await selector.navigate('delivery')
		const stale = await old
		const committed = selector.path
		selector.dispose()
		const probe = await fetch('/property-select-probe/probe/json').then(response => response.json())
		return { aborted, absentRoot, actionRoot, ambiguous, committed, configuration, context, cycle, deep, forbidden,
			forbiddenAncestor, malformed, method: method.status, newer, probe, restricted, restrictedAdvice,
			reverse, root, stale, tags, terminal, otherClass }
	})
	assert.equal(observed.context.properties[0].label, 'Invoice reference')
	assert.ok(observed.context.properties.some(property => property.name === 'delivery'))
	assert.equal(observed.context.properties.some(property => property.name === 'hidden'), false)
	assert.deepEqual(observed.root, observed.context)
	assert.equal(observed.deep.path, 'billing.city.name')
	assert.equal(observed.tags.relation.cardinality, 'many-to-many')
	assert.equal(observed.reverse.relation.inverse, observed.tags.relation.id)
	assert.equal(observed.cycle.path, 'tags.invoices.tags.label')
	assert.deepEqual(observed.configuration, { advice: ['billing', 'tags'], version: '1' })
	assert.ok(observed.otherClass.properties.some(property => property.name === 'amount'))
	for (const name of ['forbidden', 'forbiddenAncestor', 'absentRoot', 'actionRoot']) {
		assert.equal(observed[name].status, 403, name)
		assert.deepEqual(observed[name].value, { error: 'forbidden' })
		assert.equal(observed[name].cache, 'no-store')
	}
	assert.equal(observed.restricted.status, 200)
	assert.equal(observed.restricted.value.properties.some(property => property.name === 'billing'), false)
	assert.deepEqual(observed.restrictedAdvice.value, { advice: ['tags'], version: '1' })
	assert.equal(observed.ambiguous.status, 400)
	assert.equal(observed.ambiguous.value.error, 'ambiguous-type')
	assert.equal(observed.malformed.status, 400)
	assert.equal(observed.terminal.status, 400)
	assert.equal(observed.method, 400)
	assert.equal(observed.aborted, true)
	assert.equal(observed.newer, true)
	assert.equal(observed.stale, false)
	assert.equal(observed.committed, 'delivery')
	assert.deepEqual(observed.probe, { attempts: [], constructions: 0, reads: 0 })
	assert.ok(failures.some(failure => failure.url.includes('delay=180') && failure.error === 'net::ERR_ABORTED'))
	assert.deepEqual(errors, [])
	console.log(JSON.stringify({ browser: browser.version(), errors, failures, observed, origin, requests,
		status: 'PASS' }, null, 2))
}
finally {
	await browser?.close()
}
