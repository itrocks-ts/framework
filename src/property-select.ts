import { Request }                     from '@itrocks/action-request'
import { Type }                        from '@itrocks/class-type'
import { config }                      from '@itrocks/config'
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
	authorise: (request: Request, root: RootId, path: string) => boolean | Promise<boolean>
}

export type PropertySelectConfiguration = { roots?: Readonly<Record<RootId, MetadataRoot>> }

const dependencies: PropertySelectDependencies = { authorise: () => true }

export { MetadataError }                 from './property-select-provider'
export type { MetadataErrorCode }         from './property-select-provider'
export { ReflectionMetadataProvider }     from './property-select-provider'

export function bindPropertySelect(): void
{
	// Loaded after composition; action classes never trigger the framework bootstrap.
	routes.add('/property-select/configuration', '@itrocks/framework/property-select-actions:MetadataConfiguration')
	routes.add('/property-select/context', '@itrocks/framework/property-select-actions:MetadataContext')
	routes.add('/property-select/resolve', '@itrocks/framework/property-select-actions:MetadataResolve')
}

export function createMetadataProvider(request: Request): ReflectionMetadataProvider
{
	const roots = (config.propertySelect as PropertySelectConfiguration | undefined)?.roots ?? {}
	return new ReflectionMetadataProvider(roots, (root, path) => dependencies.authorise(request, root, path))
}

export async function metadataConfiguration(request: Request, root: RootId)
	: Promise<{ advice: readonly string[]; version: string }>
{
	const provider = createMetadataProvider(request)
	await provider.context(root, '')
	const source = (config.propertySelect as PropertySelectConfiguration).roots![root]
	const advice: string[] = []
	for (const path of source.advice ?? []) {
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
	return { advice: [...new Set(advice)], version: source.version ?? '1' }
}

export function propertySelectDependsOn(overrides: Partial<PropertySelectDependencies>): void
{
	Object.assign(dependencies, overrides)
}
