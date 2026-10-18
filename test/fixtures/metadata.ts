import { Group } from '@itrocks/property-group'
import { Invoice } from './invoice'

export const metadataProbe = { constructions: 0, reads: 0 }

export class MetadataInvoice extends Invoice
{

	date!:         Date
	dateArray!:    Date[]
	dateMap!:      Record<string, Date>
	genericDates!: Array<Date>
	hidden = ''
	inherited = ''
	nullableDate!: Date | null | undefined
	optionalDate?: Date

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

Group<MetadataInvoice>('summary', 'hidden')(MetadataInvoice)
Group<MetadataInvoice>('private', 'secret')(MetadataInvoice)
Group<MetadataInvoice>('references')(MetadataInvoice.prototype, 'inherited')
