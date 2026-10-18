import { Group } from '@itrocks/property-group'
import { Address } from './address'
import { City } from './city'
import { Line } from './line'
import { Tag } from './tag'

export class Invoice
{

	ambiguous!: Address | City
	billing?: Address
	delivery!: Address
	lines!: Line[]
	number = ''
	singular!: Line
	self!: Invoice[]
	tags!: Tag[]
	unknown!: unknown

	constructor()
	{
		throw new Error('Domain constructor must not execute')
	}

}

Group<Invoice>('summary', 'number', 'billing')(Invoice)
