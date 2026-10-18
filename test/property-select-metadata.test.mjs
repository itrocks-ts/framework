import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { compose } = require('@itrocks/compose')
assert.equal(require.cache[require.resolve('@itrocks/framework')], undefined)
compose('', {
	'@itrocks/reflect:ReflectClass': require.resolve('../cjs/reflect-class') + ':ReflectClass',
	'@itrocks/reflect:ReflectProperty': require.resolve('../cjs/reflect-property') + ':ReflectProperty',
	'@itrocks/template:Template': '@itrocks/template-insight:Template'
})
const { ReflectionMetadataProvider, MetadataError } = require('@itrocks/framework/property-select')
const { File } = require('@itrocks/class-file')
const { DisplayOrder, Display } = require('@itrocks/property-view')
const { List, listOf } = require('@itrocks/list-properties')
const { ReflectClass, Relation } = require('@itrocks/reflect')
const models = {}
for (const name of ['address', 'city', 'invoice', 'line', 'metadata', 'tag']) {
	const file = require.resolve(`./fixtures/${name}.js`)
	for (const [name, model] of Object.entries(require(file))) {
		if (typeof model !== 'function') continue
		File(file)(model)
		models[name] = model
	}
}
const { Invoice, Line, MetadataInvoice, Tag } = models
Relation({ cardinality: 'one-to-many', inverse: 'invoice' })(Invoice.prototype, 'lines')
Relation({ cardinality: 'many-to-one', inverse: 'lines' })(Line.prototype, 'invoice')
Relation({ cardinality: 'many-to-many', inverse: 'invoices' })(Invoice.prototype, 'tags')
Relation({ cardinality: 'many-to-many', inverse: 'tags' })(Tag.prototype, 'invoices')
DisplayOrder('number', 'billing', 'tags')(MetadataInvoice)
Display('Reference')(Invoice.prototype, 'number')
List('number')(MetadataInvoice)
const roots = { configured: { type: '/node_modules/@itrocks/framework/test/fixtures/invoice:Invoice' },
	direct: { type: Invoice }, invoice: { type: MetadataInvoice } }

test('functional groups inherit class and property declarations and expose only authorised members', async () => {
	const provider = new ReflectionMetadataProvider(roots, (_root, path) => !['billing', 'secret'].includes(path))
	const context = await provider.context('invoice', '')
	assert.deepEqual(context.groups, [
		{ label: 'summary', name: 'summary', properties: ['number', 'hidden'] },
		{ label: 'references', name: 'references', properties: ['inherited'] }
	])
	const nested = await provider.context('invoice', 'lines.invoice')
	assert.deepEqual(nested.groups, [{
		label: 'summary', name: 'summary', properties: ['lines.invoice.billing', 'lines.invoice.number']
	}])
	assert.equal(require('./fixtures/metadata.js').metadataProbe.constructions, 0)
	assert.equal(require('./fixtures/metadata.js').metadataProbe.reads, 0)
})

test('expanded relations share component groups without changing ownership facts', async () => {
	const { Component } = require('@itrocks/composition')
	const { Expand } = require('@itrocks/property-expand')
	const { PropertySelect } = require('@itrocks/property-select')
	class ExpandedInvoice extends Invoice {}
	File(require.resolve('./fixtures/invoice.js'))(ExpandedInvoice)
	Component()(ExpandedInvoice.prototype, 'billing')
	Expand(false)(ExpandedInvoice.prototype, 'billing')
	const rootMap = { expanded: { type: ExpandedInvoice } }
	const provider = new ReflectionMetadataProvider(rootMap)
	const plain = await provider.resolve('expanded', 'delivery')
	Expand()(ExpandedInvoice.prototype, 'delivery')
	const expanded = await provider.resolve('expanded', 'delivery')
	assert.deepEqual(expanded, { ...plain, component: true })
	assert.equal((await provider.resolve('expanded', 'billing')).component, true)
	assert.equal((await provider.resolve('expanded', 'tags')).component, false)
	assert.equal((await provider.context('expanded', '')).properties
		.find(property => property.name === 'delivery').component, true)
	const selector = new PropertySelect({ metadata: provider, root: 'expanded' })
	try {
		assert.equal(await selector.mount(), true)
		assert.deepEqual(selector.componentGroups.map(group => group.property.path), ['billing', 'delivery'])
		const group = selector.componentGroups.find(group => group.property.path === 'delivery')
		assert.ok(group.properties.length > 0)
		assert.ok(group.properties.every(property => property.path.startsWith('delivery.')))
		assert.equal(group.properties.some(property => property.path === 'delivery.city'), true)
	}
	finally { selector.dispose() }
	const filtered = new PropertySelect({
		metadata: new ReflectionMetadataProvider(rootMap, (_root, path) => path !== 'delivery.city'),
		root: 'expanded'
	})
	try {
		assert.equal(await filtered.mount(), true)
		assert.deepEqual(filtered.componentGroups.find(group => group.property.path === 'delivery').properties, [])
	}
	finally { filtered.dispose() }
	Expand(false)(ExpandedInvoice.prototype, 'delivery')
	assert.equal((await provider.resolve('expanded', 'delivery')).component, false)
})

test('selector metadata translates dynamic class and property labels', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'property-select-labels-'))
	try {
		const file = join(directory, 'labels.csv')
		await writeFile(file, 'metadata invoice;facture de métadonnées\nreference;référence\nsummary;synthèse\n')
		const { trLoad, trWithLanguage } = require('@itrocks/translate')
		await trLoad(file, 'fr-property-select-test')
		const context = await trWithLanguage('fr-property-select-test', () =>
			new ReflectionMetadataProvider(roots).context('invoice', ''))
		assert.equal(context.label, 'facture de métadonnées')
		assert.equal(context.groups.find(group => group.name === 'summary').label, 'synthèse')
		assert.equal(context.properties.find(property => property.name === 'number').label, 'Référence')
	}
	finally { await rm(directory, { recursive: true, force: true }) }
})

test('routed business classes need no selector root registration', async () => {
	const { bindPropertySelect, createMetadataProvider, metadataConfiguration } =
		require('@itrocks/framework/property-select')
	const { routes } = require('@itrocks/route')
	routes.add('/metadata-invoice', '/node_modules/@itrocks/framework/test/fixtures/metadata:MetadataInvoice')
	routes.add('/metadata-line', '/node_modules/@itrocks/framework/test/fixtures/line:Line')
	bindPropertySelect()
	const request = { route: '/metadata-invoice' }
	const invoice = await createMetadataProvider(request).context('/metadata-invoice', '')
	const line = await createMetadataProvider(request, '/metadata-line').context('/metadata-line', '')
	assert.ok(invoice.properties.some(property => property.name === 'number'))
	assert.ok(line.properties.some(property => property.name === 'amount'))
	assert.deepEqual(await metadataConfiguration(request, '/metadata-invoice'), { advice: [], version: '1' })
	await assert.rejects(createMetadataProvider(request, '/missing').context('/missing', ''), { code: 'forbidden' })
	await assert.rejects(createMetadataProvider(request, '/property-select/template')
		.context('/property-select/template', ''), { code: 'forbidden' })
})

// Every assertion below uses public ports and actual composed metadata; no business record is constructed.
test('META-01 metadata relation facts, inheritance and logical inverse/N-N are serialisable', async () => {
	const provider = new ReflectionMetadataProvider(roots)
	const context = await provider.context('invoice', '')
	assert.equal((await provider.resolve('configured', 'number')).path, 'number')
	assert.equal(context.path, '')
	assert.ok(context.properties.some(property => property.name === 'inherited'))
	const tags = await provider.resolve('invoice', 'tags')
	const back = await provider.resolve('invoice', 'tags.invoices')
	assert.equal(tags.relation.cardinality, 'many-to-many')
	assert.equal(back.relation.inverse, tags.relation.id)
	const lines = await provider.resolve('invoice', 'lines')
	assert.equal(lines.relation.cardinality, 'one-to-many')
	assert.equal((await provider.resolve('invoice', 'lines.invoice')).relation.cardinality, 'many-to-one')
	const tagContext = await provider.context('invoice', 'tags')
	assert.equal(tagContext.properties.some(property => property.path === 'tags.label'), true)
	const unknown = await provider.resolve('invoice', 'billing')
	assert.equal(unknown.relation.cardinality, 'unknown')
	assert.equal(unknown.relation.inverse, undefined)
	assert.deepEqual(JSON.parse(JSON.stringify(context)), context)
	assert.equal(require('./fixtures/metadata.js').metadataProbe.constructions, 0)
	assert.equal(require('./fixtures/metadata.js').metadataProbe.reads, 0)
})

test('META-02 same authorisation on enumeration and every full-path prefix; presentation beyond List', async () => {
	const seen = []
	const provider = new ReflectionMetadataProvider(roots, async (root, path) => {
		seen.push([root, path])
		return !['billing', 'hidden', 'secret'].includes(path)
	})
	const context = await provider.context('invoice', '')
	assert.equal(context.properties.some(property => property.name === 'billing'), false)
	assert.equal(context.properties.some(property => property.name === 'secret'), false)
	await assert.rejects(provider.resolve('invoice', 'billing.city.name'), { code: 'forbidden' })
	await assert.rejects(provider.context('absent', ''), { code: 'forbidden' })
	await assert.rejects(provider.context('__proto__', ''), { code: 'forbidden' })
	assert.equal(context.properties[0].label, 'Reference')
	assert.equal(context.properties[0].order, 0)
	assert.deepEqual(listOf(MetadataInvoice), ['number'])
	assert.ok(context.properties.some(property => property.name === 'delivery'))
	assert.ok(seen.some(([, path]) => path === 'billing'))
})

test('META-03 two routes, finite cycles, ambiguous/unknown paths and denied ancestors', async () => {
	const provider = new ReflectionMetadataProvider(roots)
	const billing = await provider.resolve('invoice', 'billing.city.name')
	const delivery = await provider.resolve('invoice', 'delivery.city.name')
	assert.equal(billing.name, delivery.name)
	assert.notEqual(billing.path, delivery.path)
	const cycle = 'tags.invoices.tags.invoices.number'
	assert.equal((await provider.resolve('invoice', cycle)).path, cycle)
	await assert.rejects(provider.resolve('invoice', 'ambiguous.name'), { code: 'ambiguous-type' })
	await assert.rejects(provider.context('invoice', 'unknown'), { code: 'unknown-target' })
	await assert.rejects(provider.resolve('invoice', 'number.nope'), { code: 'invalid-path' })
	await assert.rejects(provider.resolve('invoice', 'absent'), MetadataError)
	await assert.rejects(provider.resolve('invoice', 'billing..city'), TypeError)
	assert.ok(new ReflectClass(MetadataInvoice).propertyNames.includes('secret'))
	assert.equal(require('./fixtures/metadata.js').metadataProbe.constructions, 0)
	assert.equal(require('./fixtures/metadata.js').metadataProbe.reads, 0)
})

test('META-04 per-instance catalogue change, explicit path grants and aborted authorisation', async () => {
	const first = new ReflectionMetadataProvider(roots)
	assert.equal((await first.resolve('invoice', 'billing.city.name')).name, 'name')
	const changed = new ReflectionMetadataProvider({
		invoice: { paths: ['number', 'tags.label'], type: MetadataInvoice }
	})
	const changedContext = await changed.context('invoice', '')
	assert.deepEqual(changedContext.properties.map(property => property.name), ['number', 'tags'])
	assert.equal((await changed.resolve('invoice', 'tags.label')).path, 'tags.label')
	await assert.rejects(changed.resolve('invoice', 'billing.city.name'), { code: 'forbidden' })
	let release
	const entered = new Promise(resolve => { release = resolve })
	let resume
	const barrier = new Promise(resolve => { resume = resolve })
	const delayed = new ReflectionMetadataProvider(roots, async () => { release(); await barrier; return true })
	const abort = new AbortController()
	const pending = delayed.context('invoice', '', abort.signal)
	await entered
	abort.abort()
	resume()
	await assert.rejects(pending, { name: 'AbortError' })
})


test('META-01 composition merges only an unambiguous ownership inverse', async () => {
	const { Component, Composite } = require('@itrocks/composition')
	Component()(Invoice.prototype, 'lines')
	Composite()(Line.prototype, 'invoice')
	Relation()(Invoice.prototype, 'lines')
	Relation()(Line.prototype, 'invoice')
	const provider = new ReflectionMetadataProvider(roots)
	const lines = await provider.resolve('direct', 'lines')
	const inverse = await provider.resolve('direct', 'lines.invoice')
	assert.equal(lines.component, true)
	assert.equal(inverse.component, false)
	const context = await provider.context('direct', '')
	assert.equal(context.properties.find(property => property.name === 'lines').component, true)
	assert.equal(lines.relation.cardinality, 'one-to-many')
	assert.equal(inverse.relation.cardinality, 'many-to-one')
	assert.equal(inverse.relation.inverse, lines.relation.id)
	Component()(Invoice.prototype, 'singular')
	assert.equal((await provider.resolve('direct', 'lines.invoice')).relation.inverse, undefined)
	assert.equal((await provider.resolve('direct', 'lines.invoice')).relation.cardinality, 'unknown')
})

test('META-03 native dates stay terminal and context or method traversal rejects with a path error', async () => {
	const provider = new ReflectionMetadataProvider(roots)
	const context = await provider.context('invoice', '')
	for (const name of ['date', 'dateArray', 'dateMap', 'genericDates', 'nullableDate', 'optionalDate']) {
		const description = context.properties.find(property => property.name === name)
		assert.equal(description.kind, 'terminal', name)
		assert.equal(description.target, undefined)
		assert.equal(description.relation, undefined)
		assert.deepEqual(await provider.resolve('invoice', name), description)
		await assert.rejects(provider.context('invoice', name), { code: 'invalid-path', name: 'MetadataError' })
	}
	for (const name of ['date', 'nullableDate', 'optionalDate']) {
		await assert.rejects(provider.resolve('invoice', `${name}.getTime`),
			{ code: 'invalid-path', name: 'MetadataError' })
	}
	assert.equal(require('./fixtures/metadata.js').metadataProbe.constructions, 0)
	assert.equal(require('./fixtures/metadata.js').metadataProbe.reads, 0)
})

test('list bootstrap restores suggestions and saved search without browser metadata requests', async () => {
	const { metadataBootstrap } = require('@itrocks/framework/property-select')
	const { PropertySelect } = require('@itrocks/property-select')
	const { HttpMetadataProvider } = await import('../property-select-metadata.js')
	const { routes } = require('@itrocks/route')
	const root = '/bootstrap-invoice'
	routes.add(root, '/node_modules/@itrocks/framework/test/fixtures/metadata:MetadataInvoice')
	const record = { revision: 7, state: {
		branch: ['billing', 'city'], current: 1, query: 'name', recent: ['delivery', 'absent'],
		scroll: { breadcrumb: { left: 25, top: 0 } }, version: 1
	} }
	const usedPaths = ['number', 'billing.city.name', 'delivery.city.name']
	const { trLoad, trWithLanguage } = require('@itrocks/translate')
	await trLoad(new URL('../fr-FR.csv', import.meta.url).pathname, 'fr-selector-bootstrap-test')
	const initial = await trWithLanguage('fr-selector-bootstrap-test', () =>
		metadataBootstrap({ route: root }, root, usedPaths, record))
	assert.deepEqual(initial.translations, {
		'Add columns': 'Ajouter des colonnes',
		Others: 'Autres'
	})
	assert.equal(initial.record.revision, 7)
	assert.ok(initial.contexts.some(context => context.path === 'billing.city'))
	assert.ok(initial.template.includes('ps-query'))
	assert.match(initial.template, /title="Effacer la recherche"/)
	assert.match(initial.template, /aria-label="Effacer la recherche"/)
	assert.deepEqual(initial.record.state.recent, ['delivery'])
	const metadata = new HttpMetadataProvider({ initial: { ...initial, root }, fetch: async () => {
		assert.fail('Mount must use metadata in the HTML response')
	} })
	const selector = new PropertySelect({
		advice: initial.advice, metadata, root, stateKey: root, stateMode: 'session', usedPaths,
		stateStore: {
			read: async () => initial.record,
			write: async () => assert.fail('Mount must not write selector state'),
			remove: async () => assert.fail('Mount must not remove selector state')
		}
	})
	try {
		assert.equal(await selector.mount(), true)
		if (selector.search.status === 'loading') await new Promise(resolve => {
			const unsubscribe = selector.subscribe(() => {
				if (selector.search.status === 'loading') return
				unsubscribe()
				resolve()
			})
		})
		assert.deepEqual(selector.snapshot(), initial.record.state)
		assert.ok(selector.search.results.some(result => result.property.path === 'billing.city.name'))
	}
	finally { selector.dispose() }
})
