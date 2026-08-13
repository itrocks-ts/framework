import { inherits }        from '@itrocks/class-type'
import { isAnyType }       from '@itrocks/class-type'
import { Type }            from '@itrocks/class-type'
import { compositeOf }     from '@itrocks/composition'
import { CollectionType }  from '@itrocks/property-type'
import { toColumn }        from '@itrocks/rename'
import { storeOf }         from '@itrocks/store'
import { ReflectClass }    from './reflect-class'
import { ReflectProperty } from './reflect-property'

export type ColumnDefinition = ReflectProperty<any, any>
export type TableDefinition  = Type<any>

export function columnDefinitionOf(
	tableDefinition: TableDefinition, column: string
): ColumnDefinition | undefined
{
	return columnDefinitionsOf(tableDefinition)[column]
}

export function columnDefinitionsOf(tableDefinition: TableDefinition): Record<string, ColumnDefinition>
{
	return new ReflectClass(tableDefinition).property as Record<string, ColumnDefinition>
}

export function columnOf(columnDefinition: ColumnDefinition): string
{
	const tableDefinition = tableDefinitionOf(columnDefinition)
	const property        = tableDefinition && storeOf(tableDefinition)
		? columnDefinition.name.toString() + 'Id'
		: columnDefinition.name
	return toColumn(property)
}

export function isCollection(columnDefinition: ColumnDefinition): boolean
{
	return columnDefinition.type instanceof CollectionType
}

export function isScalar(columnDefinition: ColumnDefinition): boolean
{
	return tableDefinitionOf(columnDefinition) === undefined
}

export function rightColumnDefinitionOf(columnDefinition: ColumnDefinition): ColumnDefinition | undefined
{
	const leftTableDefinition  = columnDefinition.class.type
	const rightTableDefinition = tableDefinitionOf(columnDefinition)
	if (!rightTableDefinition) return
	for (const candidate of new ReflectClass(rightTableDefinition).properties) {
		if (!compositeOf(rightTableDefinition, candidate.name)) continue
		const candidateTableDefinition = tableDefinitionOf(candidate)
		if (candidateTableDefinition && inherits(leftTableDefinition, candidateTableDefinition)) return candidate
	}
}

export function tableDefinitionOf(columnDefinition: ColumnDefinition): TableDefinition | undefined
{
	const propertyType = columnDefinition.type
	const type         = (propertyType instanceof CollectionType) ? propertyType.elementType.lead : propertyType.lead
	return isAnyType(type) ? type : undefined
}

export function tableOf(tableDefinition: TableDefinition): string
{
	const table = storeOf(tableDefinition)
	if (!table) throw new Error(`Type ${tableDefinition.name} is not stored`)
	return table
}
