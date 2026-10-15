import { inherits }          from '@itrocks/class-type'
import { Type }              from '@itrocks/class-type'
import { compositeOf }       from '@itrocks/composition'
import { UnknownType }       from '@itrocks/property-type'
import { toColumn }          from '@itrocks/rename'
import { RelationshipError } from '@itrocks/sql-join'
import { storeOf }           from '@itrocks/store'
import { ReflectClass }      from './reflect-class'
import { ReflectProperty }   from './reflect-property'

export type ColumnDefinition = ReflectProperty<any, any>
export type TableDefinition  = Type<any>

export function columnDefinitionOf(
	tableDefinition: TableDefinition, column: string
): ColumnDefinition | undefined
{
	const definitions = columnDefinitionsOf(tableDefinition)
	return Object.hasOwn(definitions, column) ? definitions[column] : undefined
}

export function columnDefinitionsOf(tableDefinition: TableDefinition): Record<string, ColumnDefinition>
{
	const context = new ReflectClass(tableDefinition)
	return Object.fromEntries(Object.keys(context.propertyTypes).map(name => [name, new ReflectProperty(context, name)]))
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
	return columnDefinition.relation?.targetMultiplicity === 'many'
}

export function isScalar(columnDefinition: ColumnDefinition): boolean
{
	const relation = columnDefinition.relation
	if (relation || (columnDefinition.type instanceof UnknownType)) {
		tableDefinitionOf(columnDefinition)
		return false
	}
	return true
}

export function rightColumnDefinitionOf(columnDefinition: ColumnDefinition): ColumnDefinition | undefined
{
	const leftTableDefinition  = columnDefinition.class.type
	const rightTableDefinition = tableDefinitionOf(columnDefinition)
	if (!rightTableDefinition) return
	const candidates = Object.values(columnDefinitionsOf(rightTableDefinition)).filter(candidate => {
		if (!compositeOf(rightTableDefinition, candidate.name)) return false
		const candidateType = tableDefinitionOf(candidate)
		return candidateType && inherits(leftTableDefinition, candidateType)
	})
	if (candidates.length > 1) {
		throw new RelationshipError('unsupported-relationship', String(columnDefinition.name))
	}
	return candidates[0]
}

export function tableDefinitionOf(columnDefinition: ColumnDefinition): TableDefinition | undefined
{
	const relation = columnDefinition.relation
	if (relation && !relation.target) {
		throw new RelationshipError(
			relation.targets.length ? 'ambiguous-type' : 'unsupported-relationship', String(columnDefinition.name)
		)
	}
	if (columnDefinition.type instanceof UnknownType) {
		throw new RelationshipError('unsupported-relationship', String(columnDefinition.name))
	}
	return relation?.target
}

export function tableOf(tableDefinition: TableDefinition): string
{
	const table = storeOf(tableDefinition)
	if (!table) throw new Error(`Type ${tableDefinition.name} is not stored`)
	return table
}
