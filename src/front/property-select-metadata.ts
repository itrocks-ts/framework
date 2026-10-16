import type { MetadataProvider }    from '@itrocks/property-select/property-select.js'
import type { ObjectContext }       from '@itrocks/property-select/property-select.js'
import type { PropertyDescription } from '@itrocks/property-select/property-select.js'

export type MetadataTransportOptions = {
	endpoint?: string
	fetch?: typeof fetch
	initial?: { contexts: ObjectContext[]; errors: [string, string][]; root: string }
}

export class HttpMetadataProvider implements MetadataProvider
{

	private readonly endpoint: string
	private readonly fetcher: typeof fetch
	private readonly initial?: MetadataTransportOptions['initial']

	constructor(options: MetadataTransportOptions = {})
	{
		this.initial = options.initial
		this.endpoint = options.endpoint ?? '/property-select'
		this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
	}

	configuration(root: string, signal?: AbortSignal): Promise<{ advice: readonly string[]; version: string }>
	{
		return this.request('configuration', root, '', signal)
	}

	context(root: string, path: string, signal?: AbortSignal): Promise<ObjectContext>
	{
		signal?.throwIfAborted()
		if (this.initial?.root === root) {
			const context = this.initial.contexts.find(context => context.path === path)
			if (context) return Promise.resolve(structuredClone(context))
			const error = this.initial.errors.find(([failed]) => failed === path)
			if (error) return Promise.reject(new Error(error[1]))
		}
		return this.request('context', root, path, signal)
	}

	private async request<T>(operation: string, root: string, path: string, signal?: AbortSignal): Promise<T>
	{
		signal?.throwIfAborted()
		const query = new URLSearchParams({ path, root })
		const response = await this.fetcher(`${this.endpoint}/${operation}/json?${query}`, {
			cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal
		})
		if (!response.ok) throw new Error(`Metadata request failed (${response.status})`)
		const value = await response.json() as T
		signal?.throwIfAborted()
		return value
	}

	resolve(root: string, path: string, signal?: AbortSignal): Promise<PropertyDescription | ObjectContext>
	{
		return this.request('resolve', root, path, signal)
	}

}
