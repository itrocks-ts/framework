import assert            from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test              from 'node:test'

const require = createRequire(import.meta.url)
const { File } = require('@itrocks/class-file')
const { Component, Composite } = require('@itrocks/composition')
const { Relation } = require('@itrocks/reflect')
const { Required } = require('@itrocks/required')
const { RelationshipGraph } = require('@itrocks/sql-join')
const { Store } = require('@itrocks/store')
const { bindSqlJoins, sqlRelationshipsDependsOn } = require('@itrocks/framework/sql-relationships')
const models = {}
for (const name of ['address', 'city', 'invoice', 'line', 'tag']) {
	const filename = fileURLToPath(new URL(`./fixtures/${name}.js`, import.meta.url))
	for (const [name, model] of Object.entries(require(filename))) {
		File(filename)(model)
		Store(name.toLowerCase())(model)
		models[name] = model
	}
}
const { Address, City, Invoice, Line, Tag } = models
Relation({ cardinality: 'one-to-many', inverse: 'invoice' })(Invoice.prototype, 'lines')
Relation({ cardinality: 'many-to-one', inverse: 'lines' })(Line.prototype, 'invoice')
Relation({ cardinality: 'many-to-many', inverse: 'invoices' })(Invoice.prototype, 'tags')
Relation({ cardinality: 'many-to-many', inverse: 'tags' })(Tag.prototype, 'invoices')
Relation({ cardinality: 'many-to-many' })(Invoice.prototype, 'self')
Required()(Invoice.prototype, 'billing')
Required()(Invoice.prototype, 'delivery')
Required()(Address.prototype, 'city')
bindSqlJoins()

test('public binding uses metadata without constructors and propagates optional ancestry', () => {
	assert.equal(require.cache[require.resolve('@itrocks/framework')], undefined)
	const graph = new RelationshipGraph(Invoice, ['billing.city.name', 'delivery.city.name', 'number'])
	assert.deepEqual(graph.getOrderedJoins().map(join => join.mode), ['LEFT', 'LEFT', 'INNER', 'INNER'])
	assert.equal(graph.getPath('billing.city.name').definition.class.type, City)
	assert.equal(graph.getPath('billing').relationship.cardinality, 'unknown')
	assert.equal(graph.getPath('billing').multiplicity, 'one')
	assert.equal(graph.getPath('delivery').tableDefinition, Address)
})

test('logical inverses resolve the explicit back-reference to its physical foreign key', () => {
	const graph = new RelationshipGraph(Invoice, ['lines.amount'])
	assert.equal(graph.toSql(), 'LEFT JOIN `line` AS `t1` ON `t0`.`id` = `t1`.`invoice_id`')
	assert.equal(graph.getPath('lines.amount').multiplicity, 'many')
	assert.equal(graph.getPath('lines').relationship.inverse, 'invoice')
	assert.equal(new RelationshipGraph(Line, ['invoice.number']).getPath('invoice').multiplicity, 'one')
})

test('N-N mapping reuses existing storage naming in both directions', () => {
	const graph = new RelationshipGraph(Invoice, ['tags.label'])
	assert.equal(graph.toSql(), 'LEFT JOIN `invoice_tag` AS `t1` ON `t0`.`id` = `t1`.`invoice_id`\n'
		+ 'LEFT JOIN `tag` AS `t2` ON `t1`.`tag_id` = `t2`.`id`')
	const reverse = new RelationshipGraph(Tag, ['invoices.number'])
	assert.equal(reverse.toSql(), 'LEFT JOIN `invoice_tag` AS `t1` ON `t0`.`id` = `t1`.`tag_id`\n'
		+ 'LEFT JOIN `invoice` AS `t2` ON `t1`.`invoice_id` = `t2`.`id`')
	assert.equal(reverse.getPath('invoices.number').multiplicity, 'many')
})

test('ambiguous and unresolved targets and invalid inverse identities reject', () => {
	assert.throws(() => new RelationshipGraph(Invoice, ['ambiguous.name']), /ambiguous-type/)
	assert.throws(() => new RelationshipGraph(Invoice, ['unknown']), /unsupported-relationship|unknown-target/)
	assert.throws(() => new RelationshipGraph(Invoice, ['number.nope']), /invalid-path/)
	assert.throws(() => new RelationshipGraph(Invoice, ['constructor']), /invalid-path/)
	Relation({ cardinality: 'one-to-many', inverse: 'absent' })(Invoice.prototype, 'lines')
	assert.throws(() => new RelationshipGraph(Invoice, ['lines.amount']), /unsupported-relationship/)
	Relation({ cardinality: 'one-to-many', inverse: 'invoice' })(Invoice.prototype, 'lines')
})

test('schema override handles self links without inventing ambiguous conventional columns', () => {
	assert.throws(() => new RelationshipGraph(Invoice, ['self.number']), /unsupported-relationship/)
	sqlRelationshipsDependsOn({ mappingOf: property => property.name === 'self' ? {
		leftColumn: 'id', rightColumn: 'id',
		through: { table: 'invoice_related', leftColumn: 'source_id', rightColumn: 'target_id' }
	} : undefined })
	const graph = new RelationshipGraph(Invoice, ['self.number'])
	assert.match(graph.toSql(), /`source_id`/)
	assert.match(graph.toSql(), /`target_id`/)
	assert.equal(graph.getPath('self.number').multiplicity, 'many')
	sqlRelationshipsDependsOn({ mappingOf: () => undefined })
})

test('unambiguous component metadata resolves a legacy back-reference', () => {
	Relation()(Invoice.prototype, 'lines')
	Component()(Invoice.prototype, 'lines')
	Composite()(Line.prototype, 'invoice')
	Relation()(Line.prototype, 'invoice')
	const graph = new RelationshipGraph(Invoice, ['lines.amount'])
	assert.equal(graph.getPath('lines').relationship.cardinality, 'one-to-many')
	assert.equal(graph.getPath('lines').relationship.inverse, 'Line.invoice')
	const reverse = new RelationshipGraph(Line, ['invoice.number']).getPath('invoice')
	assert.equal(reverse.relationship.cardinality, 'many-to-one')
	assert.equal(reverse.relationship.inverse, 'Invoice.lines')
	assert.equal(graph.getPath('lines').joins[0].rightColumn, 'invoice_id')
})


test('explicit inverse identity may be qualified and conflicting cardinality fails', () => {
	Relation({ cardinality: 'one-to-many', inverse: 'Line.invoice' })(Invoice.prototype, 'lines')
	assert.equal(new RelationshipGraph(Invoice, ['lines.amount']).getPath('lines').joins[0].rightColumn, 'invoice_id')
	Relation({ cardinality: 'many-to-one' })(Invoice.prototype, 'lines')
	assert.throws(() => new RelationshipGraph(Invoice, ['lines.amount']), /unsupported-relationship/)
	Relation({ cardinality: 'one-to-many', inverse: 'invoice' })(Invoice.prototype, 'lines')
})


test('singular inverse mappings preserve target multiplicity and require known ownership', () => {
	Relation({ cardinality: 'one-to-one', inverse: 'invoice' })(Invoice.prototype, 'singular')
	assert.throws(() => new RelationshipGraph(Invoice, ['singular.amount']), /unsupported-relationship/)
	sqlRelationshipsDependsOn({ mappingOf: property => property.name === 'singular'
		? { leftColumn: 'id', rightColumn: 'invoice_id' } : undefined })
	const graph = new RelationshipGraph(Invoice, ['singular.amount'])
	assert.equal(graph.getPath('singular.amount').multiplicity, 'one')
	assert.equal(graph.toSql(), 'LEFT JOIN `line` AS `t1` ON `t0`.`id` = `t1`.`invoice_id`')
	sqlRelationshipsDependsOn({ mappingOf: () => undefined })
})

test('public projection binding applies final property SQL read and save transformers', async () => {
	const { bindSqlProjection } = require('@itrocks/framework/sql-projection')
	const { Mysql } = require('@itrocks/mysql')
	const { READ, SAVE, SQL, setPropertyTransformer } = require('@itrocks/transformer')
	bindSqlProjection()
	setPropertyTransformer(City, 'name', SQL, SAVE, async (value, object, name) => {
		assert.ok(object instanceof City)
		assert.equal(name, 'name')
		return value.toLowerCase()
	})
	setPropertyTransformer(City, 'name', SQL, READ, async (value, object, name, record) => {
		assert.ok(object instanceof City)
		assert.equal(name, 'name')
		assert.equal(record.name, value)
		return value.toUpperCase()
	})
	const queries = []
	const dao = new Mysql({})
	dao.connection = { query: async (sql, values) => {
		queries.push({ sql, values })
		if (sql.includes('COUNT(*)')) return [{ count: 1 }]
		return [Object.fromEntries([...sql.matchAll(/`(t\d+)`\.`(\w+)` AS `(p\d+)`/g)]
			.map(([, , column, alias]) => [alias, column === 'id' ? 1 : 'paris']))]
	} }
	const result = await dao.select(Invoice, ['billing.city.name'], { 'billing.city.name': 'PARIS' })
	assert.equal(result.rows[0].cells[0].value, 'PARIS')
	assert.equal(await dao.count(Invoice, { 'billing.city.name': 'PARIS' }), 1)
	assert.deepEqual(queries.map(query => query.values), [['paris'], ['paris']])
	await assert.rejects(() => dao.select(Invoice, ['ambiguous.name']), { code: 'ambiguous-type' })
	assert.equal(queries.length, 2)
})

test('selector template route serves only its published fragment', async () => {
	const { bindPropertySelect } = require('@itrocks/framework/property-select')
	const { PropertySelectTemplate } = require('@itrocks/framework/property-select-actions')
	bindPropertySelect()
	const response = await new PropertySelectTemplate().html()
	assert.equal(response.statusCode, 200)
	assert.match(response.body, /class="property-select"/)
	assert.doesNotMatch(response.body, /<html/)
	const { routes } = require('@itrocks/route')
	assert.equal(routes.destination('/property-select/template'),
		'@itrocks/framework/property-select-actions:PropertySelectTemplate')
})
