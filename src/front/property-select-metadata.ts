import type { MetadataProvider }    from '@itrocks/property-select/property-select.js'
import type { ObjectContext }       from '@itrocks/property-select/property-select.js'
import type { PropertyDescription } from '@itrocks/property-select/property-select.js'

export type MetadataTransportOptions = {
	endpoint?: string
	fetch?: typeof fetch
}

export class HttpMetadataProvider implements MetadataProvider
{

	private readonly endpoint: string
	private readonly fetcher: typeof fetch

	constructor(options: MetadataTransportOptions = {})
	{
		this.endpoint = options.endpoint ?? '/property-select'
		this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
	}

	configuration(root: string, signal?: AbortSignal): Promise<{ advice: readonly string[]; version: string }>
	{
		return this.request('configuration', root, '', signal)
	}

	context(root: string, path: string, signal?: AbortSignal): Promise<ObjectContext>
	{
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
