import { Action }                     from '@itrocks/action'
import { Request }                    from '@itrocks/action-request'
import { Type }                       from '@itrocks/class-type'
import { baseType }                   from '@itrocks/class-type'
import { isAnyType }                  from '@itrocks/class-type'
import { sessionTransaction }         from '@itrocks/fastify'
import { listDependsOn }              from '@itrocks/list'
import { listStateDependsOn }         from '@itrocks/list/selector-state'
import { ObjectContext }              from '@itrocks/property-select'
import { PropertySelect }             from '@itrocks/property-select'
import { RootId }                     from '@itrocks/property-select'
import { StateRecord }                from '@itrocks/property-select'
import { normalisePath }              from '@itrocks/property-select'
import { routes }                     from '@itrocks/route'
import { readFile }                   from 'node:fs/promises'
import { MetadataError }              from './property-select-provider'
import { ReflectionMetadataProvider } from './property-select-provider'

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
		return {
			authorise: async path => { await provider.resolve(root, path) },
			bootstrap: (paths, state) => metadataBootstrap(request, root, paths, state), root
		}
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

/** Prepare only the contexts used by restoration, suggestions and the bounded saved search. */
export async function metadataBootstrap(request: Request, root: RootId, usedPaths: string[], record: StateRecord)
{
	const provider = createMetadataProvider(request, root)
	const configuration = await metadataConfiguration(request, root)
	const contexts = new Map<string, ObjectContext>()
	const errors = new Map<string, string>()
	const selector = new PropertySelect({
		advice: configuration.advice, root, stateKey: root, stateMode: 'session', usedPaths,
		metadata: {
			context: async (root, path, signal) => {
				try {
					const context = await provider.context(root, path, signal)
					contexts.set(path, context)
					return context
				}
				catch (error) {
					errors.set(path, error instanceof Error ? error.message : 'Metadata unavailable')
					throw error
				}
			},
			resolve: (root, path, signal) => provider.resolve(root, path, signal)
		},
		stateStore: {
			read: async () => record,
			remove: async () => { throw new Error('Read-only bootstrap') },
			write: async () => { throw new Error('Read-only bootstrap') }
		}
	})
	try {
		await selector.mount()
		if (selector.search.status === 'loading') await new Promise<void>(resolve => {
			const unsubscribe = selector.subscribe(() => {
				if (selector.search.status === 'loading') return
				unsubscribe()
				resolve()
			})
		})
		return {
			...configuration, contexts: [...contexts.values()], errors: [...errors],
			record: { ...record, state: selector.snapshot() },
			template: await readFile(require.resolve('@itrocks/property-select/front/property-select.html'), 'utf8')
		}
	}
	finally { selector.dispose() }
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
