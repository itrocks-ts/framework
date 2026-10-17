import { Action }                 from '@itrocks/action'
import { Request }                from '@itrocks/action-request'
import { Template }               from '@itrocks/template'
import { createMetadataProvider } from './property-select'
import { metadataConfiguration }  from './property-select'
import { MetadataError }          from './property-select-provider'

type Operation = 'configuration' | 'context' | 'resolve'

abstract class MetadataAction extends Action
{

	protected abstract operation: Operation

	async json(request: Request)
	{
		const parameters = request.data
		const root = parameters.root
		const path = parameters.path ?? ''
		const headers = { 'Cache-Control': 'no-store' }
		if ((request.request.method !== 'GET') || request.ids.length || typeof root !== 'string' || !root
			|| typeof path !== 'string') return this.jsonResponse({ error: 'invalid-request' }, 400, headers)
		try {
			const provider = createMetadataProvider(request, root)
			const result = this.operation === 'configuration' ? await metadataConfiguration(request, root)
				: await provider[this.operation](root, path)
			return this.jsonResponse(result, 200, headers)
		}
		catch (error) {
			if (error instanceof MetadataError) {
				return this.jsonResponse({ error: error.code }, error.code === 'forbidden' ? 403 : 400, headers)
			}
			if (error instanceof TypeError) return this.jsonResponse({ error: 'invalid-path' }, 400, headers)
			throw error
		}
	}

}

export class MetadataConfiguration extends MetadataAction
{

	protected operation = 'configuration' as const

}

export class MetadataContext extends MetadataAction
{

	protected operation = 'context' as const

}

export class MetadataResolve extends MetadataAction
{

	protected operation = 'resolve' as const

}

export class PropertySelectTemplate extends Action
{

	async html()
	{
		const template = require.resolve('@itrocks/property-select/front/property-select.html')
		return this.htmlResponse(await new Template({}).parseFile(template))
	}

}
