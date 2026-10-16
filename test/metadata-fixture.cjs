const { Action } = require('@itrocks/action')
const { File } = require('@itrocks/class-file')
const { Display: ClassDisplay } = require('@itrocks/class-view')
const { List } = require('@itrocks/list-properties')
const { Display, DisplayOrder } = require('@itrocks/property-view')
const { routes } = require('@itrocks/route')
const { Relation } = require('@itrocks/reflect')
const { dataSource } = require('@itrocks/storage')
const { frontScripts } = require('@itrocks/template')
const { propertySelectDependsOn } = require('@itrocks/framework/property-select')

const attempts = []
const models = {}

frontScripts.push('/@itrocks/property-select/property-select.js')
for (const name of ['address', 'city', 'invoice', 'line', 'metadata', 'tag']) {
	const filename = require.resolve(`./fixtures/${name}.js`)
	for (const [name, model] of Object.entries(require(filename))) {
		if (typeof model !== 'function') continue
		File(filename)(model)
		models[name] = model
	}
}
const { Invoice, Line, MetadataInvoice, Tag } = models
Relation({ cardinality: 'one-to-many', inverse: 'invoice' })(Invoice.prototype, 'lines')
Relation({ cardinality: 'many-to-one', inverse: 'lines' })(Line.prototype, 'invoice')
Relation({ cardinality: 'many-to-many', inverse: 'invoices' })(Invoice.prototype, 'tags')
Relation({ cardinality: 'many-to-many', inverse: 'tags' })(Tag.prototype, 'invoices')
ClassDisplay('Invoice catalogue')(MetadataInvoice)
Display('Invoice reference')(Invoice.prototype, 'number')
DisplayOrder('number', 'billing', 'delivery', 'lines', 'tags')(MetadataInvoice)
List('number')(MetadataInvoice)
propertySelectDependsOn({ advice: () => ['billing', 'hidden', 'tags', 'absent', 'billing..city'],
	authorise: async (request, root, path) => {
	// Synthetic request-scoped policy, deliberately observable only through real HTTP in the browser suite.
	if (request.data.delay && path === 'billing') {
		await new Promise(resolve => setTimeout(resolve, Number(request.data.delay)))
	}
	if (request.data.catalogue === 'restricted' && path === 'billing') return false
	return path !== 'hidden' && path !== 'secret' && path !== 'number.secret'
} })
for (const operation of ['read', 'search', 'count', 'select']) {
	const original = dataSource()[operation]
	dataSource()[operation] = async function(type, ...args) {
		if (Object.values(models).includes(type)) {
			attempts.push(operation)
			throw new Error(`Metadata attempted business ${operation}`)
		}
		return original.call(this, type, ...args)
	}
}
class MetadataProbe extends Action
{

	async json()
	{
		return this.jsonResponse({ attempts, ...require('./fixtures/metadata.js').metadataProbe })
	}

}
routes.add('/property-select-probe/probe', '/node_modules/@itrocks/framework/test/metadata-fixture.cjs:MetadataProbe')
routes.add('/metadata-invoice', '/node_modules/@itrocks/framework/test/fixtures/metadata:MetadataInvoice')
routes.add('/metadata-line', '/node_modules/@itrocks/framework/test/fixtures/line:Line')
module.exports = { ...models, MetadataProbe }
