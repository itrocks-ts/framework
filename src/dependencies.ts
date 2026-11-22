import { initLazyLoading } from '@itrocks/lazy-loading'
initLazyLoading()

import { Action }                           from '@itrocks/action'
import { Request }                          from '@itrocks/action-request'
import { appDir }                           from '@itrocks/app-dir'
import { fileOf }                           from '@itrocks/class-file'
import { isAnyFunction }                    from '@itrocks/class-type'
import { isAnyType }                        from '@itrocks/class-type'
import { Type }                             from '@itrocks/class-type'
import { classViewDependsOn }               from '@itrocks/class-view'
import { representativeValueOf }            from '@itrocks/class-view'
import { initCollection }                   from '@itrocks/collection'
import { config }                           from '@itrocks/config'
import { initCoreTransformers }             from '@itrocks/core-transformers'
import { initStoreTransformers }            from '@itrocks/core-transformers'
import { initFileTransformers }             from '@itrocks/file'
import { formControl }                      from '@itrocks/form-controls'
import { initListProperties }               from '@itrocks/list-properties'
import { passwordDependsOn }                from '@itrocks/password'
import { setPasswordTransformers }          from '@itrocks/password/transformers'
import { propertyTranslateDependsOn }       from '@itrocks/property-translate'
import { setPropertyTranslateTransformers } from '@itrocks/property-translate/transformers'
import { displayOf }                        from '@itrocks/property-view'
import { initOrderedProperties }            from '@itrocks/property-view'
import { toColumn }                         from '@itrocks/rename'
import { toCssId, toField }                 from '@itrocks/rename'
import { Headers }                          from '@itrocks/request-response'
import { requiredOf }                       from '@itrocks/required'
import { routeDependsOn }                   from '@itrocks/route'
import { routeOf, routes }                  from '@itrocks/route'
import { createDataSource }                 from '@itrocks/storage'
import { storeDependsOn }                   from '@itrocks/store'
import { multilineDependsOn }               from '@itrocks/string-formats'
import { setMultilineTransformers }         from '@itrocks/string-formats/transformers'
import { Template }                         from '@itrocks/template'
import { templateDependsOn }                from '@itrocks/template'
import { applyTransformer }                 from '@itrocks/transformer'
import { HTML, IGNORE }                     from '@itrocks/transformer'
import { OUTPUT }                           from '@itrocks/transformer'
import { lang }                             from '@itrocks/translate'
import { tr }                               from '@itrocks/translate'
import { format, parse }                    from 'date-fns'
import { join }                             from 'node:path'
import { normalize }                        from 'node:path'

// Load the composed Template before adapters that also import it.
import { editComponents }                   from '@itrocks/edit-components'
import { bindCustomList }                   from './custom-list'
import { configureLanguages }               from './language'
import { bindPropertySelect }               from './property-select'
import { formControlDependsOn }             from './reflect-property'
import { bindSqlProjection }                from './sql-projection'

async function propertyOutput<T extends object>(object: T, property: keyof T): Promise<string>
{
	return applyTransformer(await object[property], object, property, HTML, OUTPUT)
}

export function bind()
{

	classViewDependsOn({ propertyOutput, requiredOf, tr })
	formControlDependsOn(formControl)

	if (config.dataSource) {
		createDataSource(config.dataSource)
	}

	initCollection()

	initCoreTransformers({
		displayOf,
		editComponents,
		fieldIdOf:              toCssId,
		fieldNameOf:            toField,
		formatDate:             date => format(date, tr('dd/MM/yyyy', { ucFirst: false })),
		ignoreTransformedValue: IGNORE,
		parseDate:              date => parse(date, tr('dd/MM/yyyy', { ucFirst: false }), new Date),
		propertyOutput,
		representativeValueOf,
		routeOf,
		tr
	})

	initFileTransformers()

	initListProperties()

	initOrderedProperties()

	multilineDependsOn({
		setTransformers: setMultilineTransformers
	})

	bindPropertySelect()

	bindSqlProjection()

	passwordDependsOn({
		setTransformers: setPasswordTransformers
	})

	routeDependsOn({
		calculate: (target: Type) => routes.summarize(fileOf(target).slice(appDir.length, -3))
	})

	propertyTranslateDependsOn({
		setTransformers: setPropertyTranslateTransformers
	})

	storeDependsOn({
		setTransformers: initStoreTransformers,
		toStoreName:     toColumn
	})

	templateDependsOn({
		toString: async data => (((typeof data)[0] === 'o') && (data.toString === Object.prototype.toString))
			? (await require('@itrocks/class-view').representativeValueOf(data))
			: '' + data
	})

	configureLanguages()

	bindCustomList()

	Action.prototype.htmlTemplateResponse = async function(
		data: any, request: Request, templateFile: string, statusCode = 200, headers: Headers = {}
	) {
		const containerData = Object.assign(defaultContainerData(request), this)
		const contained     = !request.request.headers['xhr-info'] && config.container?.file
		const template      = new Template(data, containerData)

		template.applicationPath = request.request.applicationPath.bind(request.request)
		template.publicUrl       = request.request.publicUrl.bind(request.request)
		template.urlAttributes.push(
			'data-custom-list-route', 'data-fetch', 'data-feed', 'data-href', 'data-link', 'data-route'
		)

		return this.htmlResponse(
			await template.parseFile(templateFile, contained && join(appDir, config.container.file)),
			statusCode,
			headers
		)
	}

}

function configContainerData()
{
	const configContainerData = config.container?.data ?? {}
	for (const [name, value] of Object.entries(configContainerData)) {
		if (!(typeof value === 'string') || !'@.'.includes(value[0])) continue
		const exported = value.includes(':')
			? require(value.split(':')[0])[value.split(':')[1]]
			: (require(value).default ?? Object.values(require(value))[0])
		configContainerData[name] =
			isAnyFunction(exported) ? exported(config[name])     :
			isAnyType(exported)     ? new exported(config[name]) :
			exported
	}
	return configContainerData
}

function defaultContainerData(request: Request)
{
	return Object.assign({
		action:      request.action,
		favicon:     config.container?.favicon  ?? normalize(join(__dirname, '../favicon.ico')),
		language:    lang(),
		manifest:    config.container?.manifest ? [config.container.manifest] : [],
		request,
		scripts:     config.container?.scripts,
		session:     request.request.session,
		styleSheets: config.container?.styleSheets,
	}, configContainerData())
}
