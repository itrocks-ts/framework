import { componentOf }       from '@itrocks/composition'
import { metadataNameOf }    from '@itrocks/decorator/property'
import { PROTECT_GET }       from '@itrocks/lazy-loading'
import { mysqlDependsOn }    from '@itrocks/mysql'
import { toColumn }          from '@itrocks/rename'
import { sqlBuildDependsOn } from '@itrocks/sql-build'
import { SqlFunction }       from '@itrocks/sql-functions'
import { storeOf }           from '@itrocks/store'
import { applyTransformer }  from '@itrocks/transformer'
import { IGNORE }            from '@itrocks/transformer'
import { READ }              from '@itrocks/transformer'
import { SAVE }              from '@itrocks/transformer'
import { SQL }               from '@itrocks/transformer'
import { ColumnDefinition }  from './sql-join-dependencies'
import { columnOf }          from './sql-join-dependencies'
import { bindSqlJoins }      from './sql-relationships'

export function bindSqlProjection(): void
{
	mysqlDependsOn({
		applyReadTransformer: async function(data, property, object) {
			const value = await applyTransformer(data[property.toString()], object, property, SQL, READ, data)
			if ((value !== IGNORE) && Reflect.getOwnMetadata(PROTECT_GET, object, metadataNameOf(property))) {
				Reflect.deleteMetadata(PROTECT_GET, object, metadataNameOf(property))
			}
			return value
		},
		applySaveTransformer: async function(object, property, data) {
			const value = Reflect.getMetadata(PROTECT_GET, object, metadataNameOf(property))
				? (Object.hasOwn(object, property) ? object[property] : undefined)
				: await object[property]
			return applyTransformer(value, object, property, SQL, SAVE, data)
		},
		columnOf:               toColumn,
		componentOf:            componentOf,
		ignoreTransformedValue: IGNORE,
		QueryFunction:          SqlFunction,
		queryFunctionCall:      value => [value.value, value.sql],
		storeOf:                storeOf
	})

	sqlBuildDependsOn<ColumnDefinition>({ columnOf })
	bindSqlJoins()
}
