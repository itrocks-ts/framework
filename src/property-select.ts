import { Action }                      from '@itrocks/action'
import { Request }                     from '@itrocks/action-request'
import { baseType }                    from '@itrocks/class-type'
import { isAnyType }                   from '@itrocks/class-type'
import { Type }                        from '@itrocks/class-type'
import { sessionTransaction }          from '@itrocks/fastify'
import { listDependsOn }               from '@itrocks/list'
import { listStateDependsOn }          from '@itrocks/list/selector-state'
import { normalisePath }               from '@itrocks/property-select'
import { RootId }                      from '@itrocks/property-select'
import { routes }                      from '@itrocks/route'
import { MetadataError }               from './property-select-provider'
import { ReflectionMetadataProvider }  from './property-select-provider'

export type MetadataRoot = {
	advice?: readonly string[]
	paths?: readonly string[]
	type: Type | string
	version?: string
}

export type PropertySelectDependencies = {
	advice: (request: Request, root: RootId) => readonly string[] | Promise<readonly string[]>
	authorise: (request: Request, root: RootId, path: string) => boolean | Promise<boolean>
}

const dependencies: PropertySelectDependencies = { advice: () => [], authorise: () => true }

function routeType(root: RootId): Type | undefined
{
	if (!root.startsWith('/')) return
	const type = routes.resolve(root)
	return isAnyType(type) && type !== Action && !(type.prototype instanceof Action) ? type : undefined
}

export { MetadataError }                 from './property-select-provider'
export type { MetadataErrorCode }         from './property-select-provider'
export { ReflectionMetadataProvider }     from './property-select-provider'

export function bindPropertySelect(): void
{
	listStateDependsOn({ transaction: sessionTransaction })
	listDependsOn({ access: async request => {
		const root = request.route
		const type = routeType(root)
		if (!type || baseType(type) !== baseType(request.type)) return { authorise: async () => {} }
		const provider = createMetadataProvider(request, root)
		await provider.context(root, '')
		return { authorise: async path => { await provider.resolve(root, path) }, root }
	} })
	// Loaded after composition; action classes never trigger the framework bootstrap.
	routes.add('/property-select/template', '@itrocks/framework/property-select-actions:PropertySelectTemplate')
	routes.add('/property-select/configuration', '@itrocks/framework/property-select-actions:MetadataConfiguration')
	routes.add('/property-select/context', '@itrocks/framework/property-select-actions:MetadataContext')
	routes.add('/property-select/resolve', '@itrocks/framework/property-select-actions:MetadataResolve')
}

export function createMetadataProvider(request: Request, root: RootId = request.route): ReflectionMetadataProvider
{
	const type = routeType(root)
	const roots = type ? { [root]: { type } } : {}
	return new ReflectionMetadataProvider(roots, (root, path) => dependencies.authorise(request, root, path))
}

export async function metadataConfiguration(request: Request, root: RootId)
	: Promise<{ advice: readonly string[]; version: string }>
{
	const provider = createMetadataProvider(request, root)
	await provider.context(root, '')
	const advice: string[] = []
	for (const path of await dependencies.advice(request, root)) {
		try {
			const canonical = normalisePath(path)
			if (!canonical) continue
			const description = await provider.resolve(root, canonical)
			if (!('properties' in description) && (description.kind === 'relation')) advice.push(canonical)
		}
		catch (error) {
			if (!(error instanceof MetadataError) && !(error instanceof TypeError)) throw error
		}
	}
	return { advice: [...new Set(advice)], version: '1' }
}

export function propertySelectDependsOn(overrides: Partial<PropertySelectDependencies>): void
{
	Object.assign(dependencies, overrides)
}
