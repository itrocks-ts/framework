
import { initLazyLoading } from '@itrocks/lazy-loading'
initLazyLoading()

import { Action }                  from '@itrocks/action'
import { Request }                 from '@itrocks/action-request'
import { appDir }                  from '@itrocks/app-dir'
import { fileOf }                  from '@itrocks/class-file'
import { Type }                    from '@itrocks/class-type'
import { classViewDependsOn }      from '@itrocks/class-view'
import { representativeValueOf }   from '@itrocks/class-view'
import { initCollection }          from '@itrocks/collection'
import { componentOf }             from '@itrocks/composition'
import { config }                  from '@itrocks/config'
import { initCoreTransformers }    from '@itrocks/core-transformers'
import { initStoreTransformers }   from '@itrocks/core-transformers'
import { PROTECT_GET }             from '@itrocks/lazy-loading'
import { Menu }                    from '@itrocks/menu'
import { mysqlDependsOn }          from '@itrocks/mysql'
import { passwordDependsOn }       from '@itrocks/password'
import { setPasswordTransformers } from '@itrocks/password/transformers'
import { displayOf }               from '@itrocks/property-view'
import { toColumn }                from '@itrocks/rename'
import { toCssId, toField }        from '@itrocks/rename'
import { Headers }                 from '@itrocks/request-response'
import { requiredOf }              from '@itrocks/required'
import { routeDependsOn }          from '@itrocks/route'
import { routeOf, routes }         from '@itrocks/route'
import { SqlFunction }             from '@itrocks/sql-functions'
import { createDataSource }        from '@itrocks/storage'
import { storeDependsOn }          from '@itrocks/store'
import { storeOf }                 from '@itrocks/store'
import { Template }                from '@itrocks/template-insight'
import { applyTransformer }        from '@itrocks/transformer'
import { IGNORE }                  from '@itrocks/transformer'
import { READ, SAVE, SQL }         from '@itrocks/transformer'
import { tr, trInit, trLoad }      from '@itrocks/translate'
import { format, parse }           from 'date-fns'
import { join }                    from 'node:path'

const menu = new Menu(config.menu)

export function bind()
{

	classViewDependsOn({ requiredOf, tr })

	createDataSource(config.dataSource)

	initCollection()

	initCoreTransformers({
		displayOf,
		fieldIdOf:              toCssId,
		fieldNameOf:            toField,
		formatDate:             date => format(date, tr('dd/MM/yyyy', { ucFirst: false })),
		ignoreTransformedValue: IGNORE,
		parseDate:              date => parse(date, tr('dd/MM/yyyy', { ucFirst: false }), new Date),
		representativeValueOf,
		routeOf,
		tr
	})

	mysqlDependsOn({
		applyReadTransformer: async function(data, property, object) {
			const value = await applyTransformer(data[property], object, property, SQL, READ, data)
			if ((value !== IGNORE) && Reflect.getOwnMetadata(PROTECT_GET, object, property)) {
				Reflect.deleteMetadata(PROTECT_GET, object, property)
			}
			return value
		},
		applySaveTransformer: async function(object, property, data) {
			const value = Reflect.getMetadata(PROTECT_GET, object, property) ? undefined : await object[property]
			return applyTransformer(value, object, property, SQL, SAVE, data)
		},
		columnOf:               toColumn,
		componentOf:            componentOf,
		ignoreTransformedValue: IGNORE,
		QueryFunction:          SqlFunction,
		queryFunctionCall:      value => [value.value, value.sql],
		storeOf:                storeOf
	})

	passwordDependsOn({
		setTransformers: setPasswordTransformers
	})

	routeDependsOn({
		calculate: (target: Type) => routes.summarize(fileOf(target).slice(appDir.length, -3))
	})

	storeDependsOn({
		setTransformers: initStoreTransformers,
		toStoreName:     toColumn
	})

	trInit('fr-FR')
	trLoad(join(__dirname, '..', 'fr-FR.csv')).catch()
	trLoad(join(appDir, 'app', 'fr-FR.csv')).catch()
	trLoad(join(appDir, 'fr-FR.csv')).catch()

	Action.prototype.htmlTemplateResponse = async function(
		data: any, request: Request, templateFile: string, statusCode = 200, headers: Headers = {}
	) {
		const containerData = {
			action: request.action,
			menu,
			request,
			session: request.request.session
		}
		Object.assign(containerData, this)
		const template = new Template(data, containerData)
		template.included = (request.request.headers['sec-fetch-dest'] === 'empty')
		return this.htmlResponse(
			await template.parseFile(templateFile, join(appDir, config.container)),
			statusCode,
			headers
		)
	}

}
