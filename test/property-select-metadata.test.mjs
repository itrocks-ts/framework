import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { compose } = require('@itrocks/compose')
const { ReflectionMetadataProvider, MetadataError } = require('@itrocks/framework/property-select')
assert.equal(require.cache[require.resolve('@itrocks/framework')], undefined)
compose('', {
	'@itrocks/reflect:ReflectClass': require.resolve('../cjs/reflect-class') + ':ReflectClass',
	'@itrocks/reflect:ReflectProperty': require.resolve('../cjs/reflect-property') + ':ReflectProperty'
})
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
	assert.equal(lines.relation.cardinality, 'one-to-many')
	assert.equal(inverse.relation.cardinality, 'many-to-one')
	assert.equal(inverse.relation.inverse, lines.relation.id)
	Component()(Invoice.prototype, 'singular')
	assert.equal((await provider.resolve('direct', 'lines.invoice')).relation.inverse, undefined)
	assert.equal((await provider.resolve('direct', 'lines.invoice')).relation.cardinality, 'unknown')
})
