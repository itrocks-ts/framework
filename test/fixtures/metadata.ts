import { Invoice } from './invoice'

export const metadataProbe = { constructions: 0, reads: 0 }

export class MetadataInvoice extends Invoice
{

	hidden = ''
	inherited = ''

	constructor()
	{
		metadataProbe.constructions ++
		super()
	}

	get secret(): string
	{
		metadataProbe.reads ++
		throw new Error('Business getters must not execute')
	}

}
