import { fileOf }                        from '@itrocks/class-file'
import { inherits }                      from '@itrocks/class-type'
import { Type }                          from '@itrocks/class-type'
import { componentOf }                   from '@itrocks/composition'
import { compositeOf }                   from '@itrocks/composition'
import { expandOf }                      from '@itrocks/property-expand'
import { groupOf }                       from '@itrocks/property-group'
import { MetadataProvider }              from '@itrocks/property-select'
import { normalisePath }                 from '@itrocks/property-select'
import { ObjectContext }                 from '@itrocks/property-select'
import { PropertyDescription }           from '@itrocks/property-select'
import { resolveDestination }            from '@itrocks/route'
import { tr }                            from '@itrocks/translate'
import { createHash }                    from 'node:crypto'
import { MetadataRoot }                  from './property-select'
import { ReflectClass }                  from './reflect-class'
import { ReflectProperty }               from './reflect-property'

export type MetadataErrorCode = 'forbidden' | 'invalid-path' | 'ambiguous-type' | 'unknown-target'
type Authorise = (root: string, path: string) => boolean | Promise<boolean>

function aborted(signal?: AbortSignal): void
{
	signal?.throwIfAborted()
}

function relationId(type: Type, name: string): string
{
	const context = new ReflectClass(type)
	const property = context.propertyTypes[name as never]
	const parent = context.parent
	if (parent && Object.hasOwn(parent.propertyTypes, name) && (parent.propertyTypes[name as never] === property)) {
		return relationId(parent.type, name)
	}
	for (const uses of context.uses) {
		if (new ReflectClass(uses).propertyTypes[name as never] === property) return relationId(uses, name)
	}
	return createHash('sha256').update(`${typeId(type)}.${name}`).digest('hex').slice(0, 24)
}

function rootType(root: MetadataRoot): Type
{
	if (typeof root.type !== 'string') return root.type
	const type = resolveDestination(root.type)
	if (typeof type !== 'function') throw new Error('Metadata root must resolve to a domain class')
	return type as Type
}

function typeId(type: Type): string
{
	return createHash('sha256').update(`${fileOf(type)}:${type.name}`).digest('hex').slice(0, 24)
}

export class MetadataError extends Error
{

	constructor(readonly code: MetadataErrorCode)
	{
		super(code)
		this.name = 'MetadataError'
	}

}

export class ReflectionMetadataProvider implements MetadataProvider
{

	constructor(
		private readonly roots: Readonly<Record<string, MetadataRoot>>,
		private readonly authorise: Authorise = () => true
	) {}

	private async allowed(root: string, path: string, signal?: AbortSignal): Promise<boolean>
	{
		aborted(signal)
		const configuration = Object.hasOwn(this.roots, root) ? this.roots[root] : undefined
		if (!configuration) return false
		const paths = configuration.paths
		if (path && paths && !paths.some(allowed => (allowed === path) || allowed.startsWith(path + '.'))) return false
		const result = await this.authorise(root, path)
		aborted(signal)
		return result
	}

	private async check(root: string, path: string, signal?: AbortSignal): Promise<void>
	{
		const parts = path ? path.split('.') : []
		for (let depth = 0; depth <= parts.length; depth ++) {
			if (!await this.allowed(root, parts.slice(0, depth).join('.'), signal)) throw new MetadataError('forbidden')
		}
	}

	async context(root: string, path: string, signal?: AbortSignal): Promise<ObjectContext>
	{
		path = normalisePath(path)
		await this.check(root, path, signal)
		const type = rootType(this.roots[root])
		const resolved = path ? this.resolved(type, path) : undefined
		if (resolved && !resolved.property.relation && resolved.targetMultiplicity !== 'unknown') {
			throw new MetadataError('invalid-path')
		}
		const target = resolved ? resolved.target : type
		if (!target) throw new MetadataError('unknown-target')
		const context = new ReflectClass(target)
		const names = this.names(context)
		const properties: PropertyDescription[] = []
		for (const name of names) {
			const full = path ? `${path}.${name}` : name
			if (await this.allowed(root, full, signal)) properties.push(this.description(context, name, full, names))
		}
		aborted(signal)
		const { displayOf: classDisplay } = require('@itrocks/class-view') as typeof import('@itrocks/class-view')
		const groups = Object.entries(groupOf(target)).map(([name, members]) => ({
			label: tr(name), name,
			properties: properties.filter(property => members.includes(property.name as never)).map(property => property.path)
		})).filter(group => group.properties.length)
		return { groups, label: tr(classDisplay(target) || target.name), path, properties, type: typeId(target) }
	}

	private description(
		context: ReflectClass, name: string, path: string, names: readonly string[]
	): PropertyDescription
	{
		const { displayOf } = require('@itrocks/property-view') as typeof import('@itrocks/property-view')
		const property = new ReflectProperty(context, name as never)
		const fact = property.relation
		const description: PropertyDescription = {
			component: !!componentOf(context.type, name as never) || expandOf(context.type, name as never),
			kind: fact ? 'relation' : 'terminal', label: tr(displayOf(context.type, name as never) || name),
			name, order: names.indexOf(name), path
		}
		if (!fact) return description
		let inverse = fact.inverse
		let cardinality = fact.cardinality
		if (fact.target) {
			description.target = typeId(fact.target)
			if (!inverse && (componentOf(context.type, name as never) || compositeOf(context.type, name as never))) {
				const opposite = componentOf(context.type, name as never) ? compositeOf : componentOf
				const candidates = Object.keys(new ReflectClass(fact.target).propertyTypes).filter(candidate => {
					if (!opposite(fact.target!, candidate as never)) return false
					const other = new ReflectProperty(fact.target!, candidate as never).relation
					return other?.target && inherits(context.type, other.target)
				})
				if (candidates.length === 1) {
					inverse = candidates[0]
					const other = new ReflectProperty(fact.target, inverse as never).relation!
					if (cardinality === 'unknown') {
						const pair = `${fact.targetMultiplicity}/${other.targetMultiplicity}`
						cardinality = pair === 'many/one' ? 'one-to-many'
							: pair === 'one/many' ? 'many-to-one' : pair === 'one/one' ? 'one-to-one' : 'unknown'
					}
				}
			}
			if (inverse) {
				const name = inverse.startsWith(fact.target.name + '.') ? inverse.slice(fact.target.name.length + 1) : inverse
				inverse = Object.hasOwn(new ReflectClass(fact.target).propertyTypes, name)
					? relationId(fact.target, name) : inverse
			}
		}
		description.relation = { cardinality, id: relationId(context.type, name), ...(inverse ? { inverse } : {}) }
		return description
	}

	private names(context: ReflectClass): string[]
	{
		const { ReflectClass: ComposedClass } = require('@itrocks/reflect') as typeof import('@itrocks/reflect')
		if (!(new ComposedClass(context.type) instanceof ReflectClass)) {
			throw new Error('Metadata requires framework reflection composition before use')
		}
		const known = Object.keys(context.propertyTypes)
		// Composed framework reflection enumerates types, so display defaults never construct domain records.
		const { displayOrderOf } = require('@itrocks/property-view') as typeof import('@itrocks/property-view')
		const order = displayOrderOf(context.type).map(String)
		return [...new Set([...order.filter(name => known.includes(name)), ...known.sort()])]
	}

	async resolve(root: string, path: string, signal?: AbortSignal): Promise<PropertyDescription | ObjectContext>
	{
		path = normalisePath(path)
		if (!path) return this.context(root, path, signal)
		await this.check(root, path, signal)
		const resolved = this.resolved(rootType(this.roots[root]), path)
		const context = new ReflectClass(resolved.property.class.type)
		aborted(signal)
		return this.description(context, String(resolved.property.name), path, this.names(context))
	}

	private resolved(type: Type, path: string)
	{
		const reflection = require('@itrocks/reflect-path') as typeof import('@itrocks/reflect-path')
		const { PropertyPathError, resolvePropertyPath } = reflection
		try { return resolvePropertyPath(new ReflectClass(type), path) }
		catch (error) {
			if (!(error instanceof PropertyPathError)) throw error
			throw new MetadataError(error.code === 'terminal-traversal' ? 'invalid-path' : error.code)
		}
	}

}
