import assert            from 'node:assert/strict'
import { spawnSync }     from 'node:child_process'
import { mkdtemp }       from 'node:fs/promises'
import { mkdir }         from 'node:fs/promises'
import { readFile }      from 'node:fs/promises'
import { rm }            from 'node:fs/promises'
import { writeFile }     from 'node:fs/promises'
import { createServer }  from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir }        from 'node:os'
import { join }          from 'node:path'
import { resolve }       from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PS_PLAYWRIGHT_MODULE
	|| '/home/baptiste/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const { compose } = require('@itrocks/compose')
compose('', { '@itrocks/template:Template': '@itrocks/template-insight:Template' })
require('../cjs/dependencies.js').bind()
const { setDataPath } = require('@itrocks/data-path')
const { File } = require('@itrocks/class-file')
const { Display } = require('@itrocks/class-view')
const { List: ListProperties } = require('@itrocks/list-properties')
const { List, listDependsOn } = require('@itrocks/list')
const { CustomList, customListDependsOn } = require('@itrocks/custom-list')
const { listState, replaceListState } = require('@itrocks/list/session-state')
const { Request } = require('@itrocks/request-response')
const { Route } = require('@itrocks/route')
const { trLoad, trWithLanguage } = require('@itrocks/translate')
const storage = require('@itrocks/storage')
const { SavedMovie } = require('./fixtures/saved-movie.js')
File(require.resolve('./fixtures/saved-movie.js'))(SavedMovie)
Display('Film')(SavedMovie)
ListProperties('title', 'year')(SavedMovie)
Route('/saved-movie')(SavedMovie)
listDependsOn({ access: async () => ({ authorise: async () => {} }) })
storage.dataSource = () => ({
	count: async () => 0,
	select: async (type, columns) => ({ rootType: type, columns: columns.map(column => ({
		path: typeof column === 'string' ? column : column.path, kind: 'scalar'
	})), rows: [] })
})
await trLoad(require.resolve('../fr-FR.csv'), 'fr-browser')
await trLoad(fileURLToPath(new URL('../../custom-list/fr-FR.csv', import.meta.url)), 'fr-browser')
const directory = await mkdtemp(join(tmpdir(), 'custom-list-browser-'))
setDataPath(directory)
const packages = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const sessions = { alice: { user: { id: 42, login: 'Alice' } }, bob: { user: { id: 43, login: 'Bob' } }, none: {} }
let identity = 'alice'
let failSave = false
const errors = []
const calls = []
const htmlSnapshots = new Map()
let saveModalCount = 0
let columnDelay = 0

customListDependsOn({ state: {
	read: request => {
		if (failSave) { failSave = false; throw new Error('Storage unavailable') }
		return listState(request.request, request.type)
	},
	replace: (request, state) => replaceListState(request.request, request.type, state)
} })

const fixtures = Object.fromEntries(await Promise.all(['home', 'output', 'shell', 'standalone'].map(async name => [
	name, await readFile(new URL(`./fixtures/custom-list-${name}.html`, import.meta.url), 'utf8')
])))

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url, 'http://localhost')
		calls.push({ path: url.pathname, query: url.search, method: request.method, xhr: request.headers['xhr-info'] })
		if (url.pathname.startsWith('/@itrocks/')) {
			const file = resolve(packages, url.pathname.slice('/@itrocks/'.length))
			if (!file.startsWith(packages + '/')) throw new Error('Invalid asset path')
			response.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript'
				: file.endsWith('.svg') ? 'image/svg+xml' : 'text/css')
			response.end(await readFile(file))
			return
		}
		if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return }
		if (url.pathname === '/fixture/standalone') {
			response.setHeader('Content-Type', 'text/html')
			response.end(fixtures.standalone)
			return
		}
		if (url.pathname === '/fixture/identity') {
			identity = url.searchParams.get('user')
			response.end('OK')
			return
		}
		if (url.pathname === '/fixture/fail-save') { failSave = true; response.end('OK'); return }
		const chunks = []
		for await (const chunk of request) chunks.push(chunk)
		const data = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()))
		Object.assign(data, Object.fromEntries(url.searchParams))
		const origin = new Request(request.method, 'http', 'localhost', server.address().port, url.pathname,
			request.headers, {}, data, sessions[identity])
		const actionRequest = { request: origin, route: '/saved-movie', type: SavedMovie, data, ids: [], action: 'list' }
		let result
		await trWithLanguage('fr-browser', async () => {
			if (url.pathname === '/fixture/home') {
				result = { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: fixtures.home }
			}
			else if (url.pathname.includes('/custom-list')) {
				if (data.mode === 'edit') saveModalCount ++
				result = await new CustomList()[url.pathname.endsWith('/json') ? 'json' : 'html'](actionRequest)
			}
			else if (url.pathname.endsWith('/1/output')) {
				result = { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: fixtures.output }
			}
			else {
				if (data.columns !== undefined && columnDelay) {
					await new Promise(resolve => setTimeout(resolve, columnDelay))
				}
				result = await new List().html(actionRequest)
			}
		})
		// A 204 configuration save has no document to validate.
		if (result.statusCode !== 204 && typeof result.body === 'string' && result.headers['Content-Type']?.includes('html')) {
			const key = [url.pathname, data.mode, data.operation, data.view, identity, data.name, result.statusCode]
				.filter(Boolean).join('-').replace(/[^a-z0-9-]+/gi, '-')
			htmlSnapshots.set(key, result.body)
		}
		if (!request.headers['xhr-info'] && !url.pathname.includes('/custom-list') && !url.searchParams.has('columns')) {
			const fragment = result.body.split('<!--BEGIN-->')[1].split('<!--END-->')[0]
			result.body = fixtures.shell.replace('<!--fixture-main-->', fragment)
		}
		response.writeHead(result.statusCode, result.headers)
		response.end(typeof result.body === 'object' ? JSON.stringify(result.body) : result.body)
	}
	catch (error) { errors.push(String(error)); response.writeHead(500).end(String(error)) }
})
await new Promise((resolve, reject) => {
	server.once('error', reject)
	server.listen(0, '127.0.0.1', resolve)
})
let browser
let completed = false
try {
	browser = await chromium.launch({ chromiumSandbox: true, headless: true })
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, hasTouch: true })
	page.setDefaultTimeout(8000)
	page.on('pageerror', error => errors.push(error.message))
	const root = `http://127.0.0.1:${server.address().port}`
	const base = page.locator('li[data-action=list] > a[data-custom-list]')
	const active = page.locator('li[data-action=custom-list] > a')
	const save = page.locator('.save-list')
	const choose = page.locator('.choose-list')
	const name = save.locator('input[name=name]')
	const saveButton = save.locator('li.save input[type=submit]')
	const visibility = value => save.locator(`input[name=visibility][value=${value}]`)
	const navigation = () => page.evaluate(() => ({ href: location.href, length: history.length }))
	const snapshot = async name => {
		if (process.env.HTML_QA_DIR) htmlSnapshots.set('dom-' + name, await page.content())
	}
	const reload = async user => {
		await page.request.get(`${root}/fixture/identity?user=${user}`)
		await page.goto(`${root}/saved-movie/list`)
		await page.waitForFunction(() => window.ready)
		await base.waitFor()
	}
	const assertStableModal = async () => {
		const dialog = save.locator('..')
		const initial = await dialog.boundingBox()
		const initialName = await name.inputValue()
		const initialVisibility = await save.locator('input[name=visibility]:checked').inputValue()
		for (const label of ['Films', '', 'Nom disponible', initialName]) {
			await name.fill(label)
			assert.deepEqual(await dialog.boundingBox(), initial,
				'Reserved, empty, available and existing names keep the modal position and height')
		}
		for (const scope of ['private', 'public', 'protected', initialVisibility]) {
			await visibility(scope).check()
			assert.deepEqual(await dialog.boundingBox(), initial, 'Visibility changes keep the same modal bounds')
		}
	}
	const waitModified = async (link, label) => {
		await page.waitForFunction(() =>
			document.querySelector('ol.breadcrumb a[data-active=true]')?.dataset.modified === 'true'
		)
		assert.equal(await link.textContent(), label, 'The modification marker leaves the DOM label unchanged')
		assert.equal(await link.evaluate(element => getComputedStyle(element, '::after').content), '"*"')
	}
	const waitValid = async () => {
		await page.waitForFunction(() => !document.querySelector('.save-list input[name=save]').disabled)
	}
	const filter = async value => {
		const requestCount = calls.length
		const article = await page.locator('main > article').elementHandle()
		const input = page.locator('input[data-property-filter=title]')
		await input.fill(value)
		await input.press('Enter')
		await page.waitForFunction(previous => !previous.isConnected, article)
		await active.waitFor()
		assert.equal(calls.slice(requestCount).some(call => call.query.includes('mode=breadcrumb')), false,
			'Filtering returns the list and its breadcrumb in one response')
	}
	const saveAs = async (label, scope) => {
		await base.dblclick()
		await name.fill(label)
		await visibility(scope).check()
		await waitValid()
		await saveButton.click()
		await save.waitFor({ state: 'detached' })
		await page.waitForFunction(label => document.querySelector('li[data-action=custom-list] a')?.textContent === label, label)
	}
	await page.goto(`${root}/fixture/home`)
	await page.waitForFunction(() => window.ready)
	assert.equal(calls.some(call => call.path.startsWith('/@itrocks/custom-list/')), false,
		'The framework shell does not load the saved-list package on an unrelated page')
	await page.locator('#movies').click()
	await base.waitFor()
	assert.equal(calls.some(call => call.path === '/@itrocks/custom-list/custom-list.js'), true)
	assert.equal(calls.some(call => call.path === '/@itrocks/custom-list/build.js'), false,
		'The list breadcrumb does not load modal behaviour')
	assert.equal(calls.some(call => call.path === '/@itrocks/modal/modal.js'), false)
	assert.equal(calls.some(call => call.path === '/@itrocks/custom-list/custom-list.css'), false)
	assert.equal(await page.locator('link[href="/@itrocks/custom-list/custom-list.css"]').count(), 0)
	assert.equal(await base.textContent(), 'Films')
	assert.equal(await base.getAttribute('target'), '#modal')
	assert.match(await base.getAttribute('href'), /custom-list\?mode=choose/)
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '700')
	assert.notEqual(await base.evaluate(element => getComputedStyle(element, '::after').content), '"*"')
	assert.equal(await page.locator('li[data-action=custom-list]').isVisible(), false)
	assert.equal(calls.some(call => call.query.includes('mode=breadcrumb')), false,
		'The list response supplies its breadcrumb without a second request')
	await snapshot('default-list')
	const beforeEditor = await navigation()
	await base.dblclick()
	await save.waitFor()
	assert.deepEqual(await navigation(), beforeEditor, 'Opening the editor preserves the URL and history')
	await page.waitForFunction(() => !!document.querySelector('input[name=name]:not(:disabled)'))
	assert.equal(calls.some(call => call.path === '/@itrocks/custom-list/build.js'), true)
	assert.equal(calls.some(call => call.path === '/@itrocks/modal/modal.js'), true)
	await page.waitForFunction(() => [...document.styleSheets].some(sheet =>
		sheet.href?.endsWith('/@itrocks/custom-list/custom-list.css')))
	assert.equal(calls.filter(call => call.path === '/@itrocks/custom-list/custom-list.css').length, 1)
	await page.waitForFunction(() => !document.querySelector('.save-list input[name=name]').disabled)
	assert.equal(await name.inputValue(), 'Films')
	assert.equal(await save.getAttribute('target'), '#notifications:prepend')
	assert.equal(await save.getAttribute('method'), 'post')
	assert.equal(await save.locator('a[href="about:blank"]').getAttribute('target'), '#modal:replace')
	await save.locator('.error').waitFor({ state: 'visible' })
	assert.match(await save.locator('.error').textContent(), /autre nom/)
	assert.equal(await saveButton.isDisabled(), true)
	const typingRequests = calls.length
	await name.fill('Autre nom')
	await visibility('public').check()
	await visibility('protected').check()
	await visibility('private').check()
	await name.fill('Films prêtés')
	assert.equal(calls.slice(typingRequests).some(call => call.path.includes('/custom-list/')), false,
		'Name and visibility changes validate locally')
	assert.match(await saveButton.evaluate(element => getComputedStyle(element.parentElement).backgroundImage), /save.svg/)
	const layout = await save.evaluate(form => {
		const heading = form.querySelector('h2')
		const dialog = form.parentElement
		return { top: getComputedStyle(heading).marginTop,
			padding: getComputedStyle(dialog).paddingTop,
			cancel: form.querySelector('a[href="about:blank"]').getBoundingClientRect().x,
			save: form.querySelector('li.save input[type=submit]').getBoundingClientRect().x }
	})
	assert.equal(layout.top, '0px')
	assert.equal(layout.padding, '20px')
	assert.ok(layout.cancel < layout.save)
	await waitValid()
	assert.equal(await save.locator('.overwrite').isVisible(), false)
	assert.equal(await visibility('private').isChecked(), true)
	await snapshot('save-modal')
	const mainBeforeSave = await page.locator('main > article').elementHandle()
	const callsBeforeSave = calls.length
	await saveButton.click()
	await save.waitFor({ state: 'detached' })
	await active.waitFor()
	assert.equal(await mainBeforeSave.evaluate(element => element.isConnected), true)
	assert.equal(calls.slice(callsBeforeSave).some(call => call.path === '/saved-movie/list'), false)
	assert.match(await page.locator('#notifications > li').first().textContent(), /Films prêtés.*enregistré/)
	assert.equal(calls.slice(callsBeforeSave).filter(call => call.method === 'POST').every(call => !!call.xhr), true)
	assert.equal(await active.textContent(), 'Films prêtés')
	assert.equal(await active.evaluate(element => getComputedStyle(element).fontWeight), '700')
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '400',
		'Saving a custom list removes emphasis from its default parent')
	await snapshot('saved-list')
	assert.equal(await choose.count(), 0, 'Double-click does not open the chooser')
	await page.locator('input[data-property-filter=title]').fill('unapplied')
	await active.dblclick()
	await save.locator('.overwrite').waitFor({ state: 'visible' })
	assert.equal(await saveButton.isDisabled(), true)
	await assertStableModal()
	await page.setViewportSize({ width: 360, height: 640 })
	await assertStableModal()
	const footer = await save.locator('footer').boundingBox()
	const buttons = await Promise.all(['.delete', '.close', '.save'].map(selector =>
		save.locator('footer ul.actions > ' + selector).boundingBox()))
	assert.ok(buttons[0].x < buttons[1].x && buttons[1].x < buttons[2].x)
	assert.ok(buttons.every(bounds => bounds.x >= footer.x && bounds.x + bounds.width <= footer.x + footer.width))
	assert.equal(await save.locator('.overwrite').evaluate(element => getComputedStyle(element).columnGap), '8px')
	await page.screenshot({ path: '/tmp/custom-list-overwrite-mobile.png' })
	await page.setViewportSize({ width: 1000, height: 800 })
	const overwriteRequests = calls.length
	await save.locator('input[name=overwrite]').check()
	assert.equal(calls.length, overwriteRequests, 'Overwrite confirmation needs no server request')
	await waitValid()
	await saveButton.click()
	await save.waitFor({ state: 'detached' })
	assert.equal(sessions.alice.list['/saved-movie'].filter.title, '', 'Unapplied filter input is not saved')
	const beforeChooser = await navigation()
	await base.click()
	await choose.waitFor()
	assert.deepEqual(await navigation(), beforeChooser, 'Opening the chooser preserves the URL and history')
	assert.equal(await choose.locator('form').count(), 0)
	assert.equal(await page.locator('#modal form').count(), 0)
	assert.equal(await choose.locator('a.default').getAttribute('target'), 'main')
	assert.equal(await choose.locator('a[data-key="films-pretes-42"]').getAttribute('href'),
		'/saved-movie/list?custom=films-pretes-42')
	assert.equal(await choose.locator('a[href="about:blank"]').getAttribute('target'), '#modal:replace')
	assert.equal((await choose.locator('a.default').textContent()).trim(), 'Films')
	assert.equal(await choose.locator('a[data-key="films-pretes-42"] [role=img]').getAttribute('aria-label'), 'Liste privée')
	assert.equal(await choose.locator('a.default .list-icon.default').count(), 1)
	assert.equal(await choose.locator('a[data-key="films-pretes-42"] .list-icon.private').count(), 1)
	assert.equal(await choose.locator('a.default').getAttribute('data-target-history'), 'false')
	assert.equal(await choose.locator('a.default .list-icon').evaluate(icon => getComputedStyle(icon).color),
		'rgb(136, 136, 136)')
	assert.equal(await choose.locator('a.default').evaluate(link => getComputedStyle(link).gap), '12px')
	const selected = choose.locator('a[aria-selected=true]')
	assert.equal(await selected.evaluate(link => getComputedStyle(link).outlineStyle), 'none')
	assert.notEqual(await selected.evaluate(link => getComputedStyle(link).backgroundColor), 'rgba(0, 0, 0, 0)')
	await choose.locator('a.default').hover()
	assert.equal(await choose.locator('a.default').evaluate(link => getComputedStyle(link).backgroundColor),
		'rgb(244, 244, 244)')
	assert.equal(await choose.locator('a.default .list-icon').evaluate(icon => getComputedStyle(icon).color),
		'rgb(47, 137, 67)')
	await page.mouse.move(0, 0)
	await page.screenshot({ path: '/tmp/custom-list-chooser.png' })
	await snapshot('choose-modal')
	await choose.locator('a.default').press('Enter')
	await active.waitFor({ state: 'detached' })
	await base.waitFor()
	assert.equal(await base.textContent(), 'Films')
	assert.deepEqual(await navigation(), beforeChooser, 'Loading a configuration preserves the URL and history')
	await saveAs('Public', 'public')
	await saveAs('A < B & "C"', 'private')
	await saveAs('Protégée', 'protected')
	// Save waits for the real list persistence queue rather than recording stale columns.
	await active.dblclick()
	await name.fill('Pending columns')
	await visibility('private').check()
	await waitValid()
	columnDelay = 500
	await page.evaluate(() => {
		void window.listReady.request(new URLSearchParams({ columns: 'year,title' }))
	})
	await saveButton.click()
	await save.waitFor({ state: 'detached' })
	const pendingSave = JSON.parse(await readFile(join(directory,
		'custom-lists/@itrocks/framework/test/fixtures/saved-movie/pending-columns-42.json'), 'utf8'))
	assert.deepEqual(pendingSave.state.columns, ['year', 'title'])
	columnDelay = 0
	await base.click()
	await choose.locator('a[data-key=protegee]').click()
	await choose.waitFor({ state: 'detached' })
	await page.waitForFunction(() => document.querySelector('li[data-action=custom-list] a')?.textContent === 'Protégée')
	const beforeColumns = calls.length
	const columnsArticle = await page.locator('main > article').elementHandle()
	await page.evaluate(() => window.listReady.request(new URLSearchParams({
		columns: [...document.querySelectorAll('table.objects thead th[data-property]')]
			.map(header => header.dataset.property).join(',')
	})))
	assert.equal(await active.textContent(), 'Protégée', 'Persisting unchanged columns does not mark the save modified')
	await page.evaluate(() => window.listReady.request(new URLSearchParams({ columns: 'year,title' })))
	await waitModified(active, 'Protégée')
	assert.equal(await columnsArticle.evaluate(article => article.isConnected), true)
	assert.equal(calls.slice(beforeColumns).some(call => call.query.includes('mode=breadcrumb')), false,
		'Changing columns updates the marker locally, without another request')
	await snapshot('changed-columns')
	// A real filter submission marks the active save dirty and remains dirty when the filter is restored.
	await filter('Alien')
	await waitModified(active, 'Protégée')
	assert.equal(await active.evaluate(element => getComputedStyle(element).fontWeight), '400')
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '400')
	await filter('')
	await waitModified(active, 'Protégée')
	await page.locator('#view').click()
	await page.locator('article[data-action=output]').waitFor()
	await active.waitFor()
	assert.equal(await page.locator('ol.breadcrumb > li').count(), 4)
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '400')
	await base.click()
	await page.locator('article[data-action=list]').waitFor()
	await active.waitFor({ state: 'detached' })
	assert.equal(await choose.count(), 0, 'The default breadcrumb from a record returns directly to the default list')
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '700')
	await base.click()
	await choose.locator('a[data-key=protegee]').waitFor()
	await choose.locator('a[data-key=protegee]').click()
	await choose.waitFor({ state: 'detached' })
	await active.waitFor()
	// The persistent fixture link uses the framework's one-second secure-click interval.
	await page.waitForTimeout(1100)
	await page.locator('#view').click()
	await page.locator('article[data-action=output]').waitFor()
	const beforeRecordReturn = await navigation()
	await active.click()
	await page.locator('article[data-action=list]').waitFor()
	await page.waitForFunction(() => document.querySelector('li[data-action=custom-list] a')?.textContent === 'Protégée')
	assert.equal(await choose.count(), 0, 'The custom breadcrumb from a record loads the saved configuration directly')
	assert.deepEqual(await navigation(), beforeRecordReturn, 'A native breadcrumb link respects data-target-history')
	assert.equal(await active.evaluate(element => getComputedStyle(element).fontWeight), '700')
	assert.equal(await base.evaluate(element => getComputedStyle(element).fontWeight), '400')
	await active.dblclick()
	await save.locator('.overwrite').waitFor({ state: 'visible' })
	const beforeDelete = await page.locator('main > article').elementHandle()
	const deleteRequests = calls.length
	await save.locator('li.delete > a').click()
	const confirmation = page.locator('#modal form[data-action=confirm]')
	await confirmation.waitFor()
	assert.equal(sessions.alice.customLists['/saved-movie'].key, 'protegee')
	await snapshot('delete-confirmation')
	await confirmation.locator('a').click()
	await confirmation.waitFor({ state: 'detached' })
	assert.equal(sessions.alice.customLists['/saved-movie'].key, 'protegee', 'Cancel keeps the saved list')
	await active.dblclick()
	await save.locator('li.delete > a').click()
	await confirmation.waitFor()
	assert.equal(await confirmation.getAttribute('target'), '#notifications:prepend')
	await confirmation.locator('input[type=submit]').click()
	await confirmation.waitFor({ state: 'detached' })
	assert.equal(await beforeDelete.evaluate(element => element.isConnected), true)
	assert.equal(calls.slice(deleteRequests).some(call => call.path === '/saved-movie/list'), false)
	assert.match(await page.locator('#notifications > li').first().textContent(), /Protégée.*supprimé/)
	await active.waitFor({ state: 'detached' })
	await waitModified(base, 'Films')
	assert.equal(await page.locator('li[data-action=custom-list]').isVisible(), false)
	await saveAs('Protégée', 'protected')
	await reload('bob')
	await base.click()
	await choose.locator('a[data-key=protegee]').click()
	await choose.waitFor({ state: 'detached' })
	await active.waitFor()
	await active.dblclick()
	await save.locator('.error').waitFor({ state: 'visible' })
	assert.match(await save.locator('.error').textContent(), /Alice/)
	await assertStableModal()
	assert.equal(await saveButton.isDisabled(), true)
	assert.equal(await save.locator('li.delete').isVisible(), false)
	await visibility('public').check()
	assert.equal(await saveButton.isDisabled(), true)
	await visibility('private').check()
	await waitValid()
	await page.request.get(`${root}/fixture/fail-save`)
	await saveButton.click()
	await page.locator('#notifications > li.error').filter({ hasText: "Impossible d'enregistrer cette liste" }).waitFor()
	assert.equal(await save.isVisible(), true, 'A storage error keeps the form open')
	assert.equal(await save.locator('.error').isVisible(), false, 'Storage failures use the notification area')
	await snapshot('failed-save')
	await page.waitForTimeout(1100)
	await saveButton.click()
	await save.waitFor({ state: 'detached' })
	await reload('none')
	await base.click()
	await choose.waitFor()
	assert.equal(await choose.locator('.saved-lists a:not(.default)').count(), 2, 'Anonymous users see only public lists')
	await choose.locator('a.default').focus()
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press(' ')
	await choose.waitFor({ state: 'detached' })
	await active.waitFor()
	const previousModalCount = saveModalCount
	await active.dblclick()
	await page.waitForTimeout(600)
	assert.equal(await save.count(), 0)
	assert.equal(saveModalCount, previousModalCount, 'Anonymous double-click makes no edit request')
	await reload('alice')
	const rect = await base.boundingBox()
	await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
	await page.mouse.down()
	await save.waitFor({ state: 'visible' })
	await page.waitForTimeout(1200)
	await page.mouse.up()
	await page.waitForTimeout(350)
	assert.equal(await choose.count(), 0, 'Releasing a long-held pointer does not open the chooser')
	await page.keyboard.press('Escape')
	await save.waitFor({ state: 'detached' })
	await page.waitForTimeout(1100)
	const cdp = await page.context().newCDPSession(page)
	const touch = await base.boundingBox()
	const x = touch.x + touch.width / 2, y = touch.y + touch.height / 2
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
	await save.waitFor({ state: 'visible' })
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
	await page.keyboard.press('Escape')
	await save.waitFor({ state: 'detached' })
	await page.waitForTimeout(750)
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
	await page.waitForTimeout(550)
	assert.equal(await save.count(), 0, 'Cancelled touch does not open a form')
	await base.focus()
	await page.keyboard.press('F2')
	await save.waitFor({ state: 'visible' })
	await name.fill('Mobile preview')
	await waitValid()
	assert.equal(await save.locator('.overwrite').isVisible(), false)
	await page.setViewportSize({ width: 360, height: 640 })
	const bounds = await save.boundingBox()
	assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360)
	await page.screenshot({ path: '/tmp/custom-list-mobile.png' })
	await save.locator('a[href="about:blank"]').click()
	await save.waitFor({ state: 'detached' })
	assert.equal(await base.evaluate(element => element.getAttribute('target')), '#modal')
	assert.equal(await page.locator('link[href="/@itrocks/custom-list/custom-list.css"]').count(), 1)
	assert.equal(calls.some(call => call.query.includes('mode=breadcrumb') && call.query.includes('view=list')), false)
	assert.deepEqual(errors, [])
	const standaloneRequests = calls.length
	const standalone = await browser.newPage()
	await standalone.goto(`${root}/fixture/standalone`)
	await standalone.waitForFunction(() => window.ready)
	assert.equal(calls.slice(standaloneRequests).some(call => call.path.startsWith('/@itrocks/framework/')
		&& !call.path.startsWith('/@itrocks/framework/test/fixtures/')), false,
		'Importing the package outside the framework does not import or bind the framework')
	assert.equal(calls.slice(standaloneRequests).some(call => call.path === '/saved-movie/custom-list/json'), false)
	await standalone.close()
	completed = true

	console.log('Custom list browser: gestures, keyboard, visibility, rights, dirty state, record navigation, errors and mobile OK')
}
catch (error) {
	console.error('Recent requests:', calls.slice(-15))
	if (browser) for (const context of browser.contexts()) for (const page of context.pages()) {
		console.error(await page.locator('#modal').innerHTML().catch(() => 'No modal'))
	}
	throw error
}
finally {
	if (process.env.HTML_QA_DIR) {
		await mkdir(process.env.HTML_QA_DIR, { recursive: true })
		for (const [name, html] of htmlSnapshots) {
			await writeFile(join(process.env.HTML_QA_DIR, name + '.html'), html)
		}
	}
	await browser?.close()
	await new Promise(resolve => server.close(resolve))
	await rm(directory, { force: true, recursive: true })
	if (errors.length) console.error(errors)
	if (completed && process.env.VNU_JAR && process.env.HTML_QA_DIR) {
		const files = [...htmlSnapshots.keys()].map(name => join(process.env.HTML_QA_DIR, name + '.html'))
		const validation = spawnSync('java', ['-jar', process.env.VNU_JAR, '--errors-only', '--format', 'json', ...files],
			{ encoding: 'utf8' })
		assert.equal(validation.status, 0, validation.error?.message || validation.stdout + validation.stderr)
		console.log(`W3C Nu: ${files.length} rendered HTML and DOM snapshots passed`)
	}
}
