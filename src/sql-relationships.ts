import { inherits }                from '@itrocks/class-type'
import { componentOf }             from '@itrocks/composition'
import { compositeOf }             from '@itrocks/composition'
import { joinTableName }           from '@itrocks/mysql'
import { PropertyPathError }       from '@itrocks/reflect-path'
import { resolvePropertyPath }     from '@itrocks/reflect-path'
import { toColumn }                from '@itrocks/rename'
import { requiredOf }              from '@itrocks/required'
import { Relationship }            from '@itrocks/sql-join'
import { RelationshipError }       from '@itrocks/sql-join'
import { RelationshipMapping }     from '@itrocks/sql-join'
import { sqlJoinDependsOn }        from '@itrocks/sql-join'
import { storeOf }                 from '@itrocks/store'
import { ColumnDefinition }        from './sql-join-dependencies'
import { columnDefinitionOf }      from './sql-join-dependencies'
import { columnDefinitionsOf }     from './sql-join-dependencies'
import { columnOf }                from './sql-join-dependencies'
import { isCollection }            from './sql-join-dependencies'
import { isScalar }                from './sql-join-dependencies'
import { rightColumnDefinitionOf } from './sql-join-dependencies'
import { TableDefinition }         from './sql-join-dependencies'
import { tableDefinitionOf }       from './sql-join-dependencies'
import { tableOf }                 from './sql-join-dependencies'

export type SqlRelationshipDependencies = {
	mappingOf: (property: ColumnDefinition) => RelationshipMapping | undefined
}

export type { ColumnDefinition, TableDefinition } from './sql-join-dependencies'

const dependencies: SqlRelationshipDependencies = { mappingOf: () => undefined }

export function bindSqlJoins(): void
{
	sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
		columnDefinitionOf, columnDefinitionsOf, columnOf, componentOf, isCollection, isScalar,
		multiplicityOf: property => {
			try { return resolvePropertyPath(property.class, [String(property.name)]).targetMultiplicity }
			catch (error) {
				if (!(error instanceof PropertyPathError)) throw error
				throw new RelationshipError(error.code === 'ambiguous-type' ? 'ambiguous-type'
					: error.code === 'invalid-path' ? 'invalid-path' : 'unsupported-relationship', error.path)
			}
		},
		relationshipOf, requiredOf, rightColumnDefinitionOf,
		storedAsValueOf: property => {
			const target = tableDefinitionOf(property)
			return !!target && !storeOf(target)
		},
		tableDefinitionOf, tableOf
	})
}

export function relationshipOf(table: TableDefinition, column: string, property: ColumnDefinition): Relationship
{
	const fact   = property.relation
	const target = tableDefinitionOf(property)
	if (!fact || !target) throw new RelationshipError('unsupported-relationship', column)
	const multiplicity = fact.targetMultiplicity
	if (((multiplicity === 'many') && ['many-to-one', 'one-to-one'].includes(fact.cardinality))
		|| ((multiplicity === 'one') && ['one-to-many', 'many-to-many'].includes(fact.cardinality))) {
		throw new RelationshipError('unsupported-relationship', column)
	}
	let mapping = dependencies.mappingOf(property)
	let inverse: ColumnDefinition | undefined
	if (!mapping && fact.inverse) {
		// A qualified identity is explicit; arbitrary catalogue ids require a schema mapping.
		const prefix = `${target.name}.`
		const name = fact.inverse.startsWith(prefix) ? fact.inverse.slice(prefix.length) : fact.inverse
		inverse = columnDefinitionOf(target, name)
		const inverseTarget = inverse && tableDefinitionOf(inverse)
		if (!inverse || !inverseTarget || !inherits(table, inverseTarget)) {
			throw new RelationshipError('unsupported-relationship', column)
		}
	}
	if (!mapping && !inverse && compositeOf(table, column)) {
		const candidates = Object.values(columnDefinitionsOf(target)).filter(candidate => {
			if (!componentOf(target, candidate.name)) return false
			const candidateTarget = tableDefinitionOf(candidate)
			return candidateTarget && inherits(table, candidateTarget)
		})
		if (candidates.length > 1) throw new RelationshipError('unsupported-relationship', column)
		inverse = candidates[0]
	}
	const conventionalCollection = (fact.cardinality === 'unknown')
		&& (multiplicity === 'many')
		&& !componentOf(table, column)
	if (!mapping && ((fact.cardinality === 'many-to-many') || conventionalCollection)) {
		const left  = tableOf(table)
		const right = tableOf(target)
		if ((left === right) || (toColumn(left) === toColumn(right))) {
			throw new RelationshipError('unsupported-relationship', column)
		}
		mapping = {
			leftColumn: 'id', rightColumn: 'id',
			through: { leftColumn: toColumn(left) + '_id', rightColumn: toColumn(right) + '_id',
				table: joinTableName(left, right) }
		}
	}
	if (!mapping) {
		const component = componentOf(table, column)
		if ((multiplicity === 'many') || component) {
			inverse ??= rightColumnDefinitionOf(property)
			if (!inverse || (inverse.relation?.targetMultiplicity !== 'one')) {
				throw new RelationshipError('unsupported-relationship', column)
			}
			mapping = { leftColumn: 'id', rightColumn: columnOf(inverse) }
		}
		else {
			if (inverse && (fact.cardinality === 'one-to-one') && !compositeOf(table, column)) {
				throw new RelationshipError('unsupported-relationship', column)
			}
			mapping = { leftColumn: columnOf(property), rightColumn: 'id' }
		}
	}
	let cardinality = fact.cardinality
	if (cardinality === 'unknown') {
		if (multiplicity === 'many') {
			cardinality = componentOf(table, column) ? 'one-to-many' : 'many-to-many'
		}
		else if (multiplicity === 'one') {
			const owned = componentOf(table, column)
				|| (compositeOf(table, column) && (inverse?.relation?.targetMultiplicity === 'one'))
			cardinality = owned ? 'one-to-one' : 'many-to-one'
		}
	}
	return {
		...mapping, cardinality, inverse: fact.inverse ?? (inverse ? `${target.name}.${String(inverse.name)}` : undefined),
		multiplicity,
		optional: fact.optional || !requiredOf(table, column)
	}
}

export function sqlRelationshipsDependsOn(overrides: Partial<SqlRelationshipDependencies>): void
{
	Object.assign(dependencies, overrides)
}
