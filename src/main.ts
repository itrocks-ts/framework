import { Action }                 from '@itrocks/action'
import { needOf }                 from '@itrocks/action'
import { actionRequestDependsOn } from '@itrocks/action-request'
import { Request }                from '@itrocks/action-request'
import { appDir }                 from '@itrocks/app-dir'
import { isAnyType }              from '@itrocks/class-type'
import { config }                 from '@itrocks/config'
import { FastifyServer }          from '@itrocks/fastify'
import { FileStore }              from '@itrocks/fastify-file-session-store'
import { Response }               from '@itrocks/request-response'
import { loadRoutes, routes }     from '@itrocks/route'
import { storeOf }                from '@itrocks/store'
import { frontScripts }           from '@itrocks/template'
import { join }                   from 'node:path'
import { normalize }              from 'node:path'

type ActionObject   = Record<string, ActionFunction>
type ActionFunction = (request: Request) => Promise<Response>

frontScripts.push(
	'/lib/air-datepicker/locale/en.js',
	'/lib/air-datepicker/locale/fr.js'
)

async function execute(request: Request): Promise<Response>
{
	// Access control
	if (
		(config.access?.free !== '*')
		&& !request.request.session.user
		&& !config.access?.free?.includes(request.route + '/' + request.action)
	) {
		request.action = 'login'
		request.route  = '/user'
	}

	// Resolve action class or function module
	const module = routes.resolve(request.route + '/' + request.action)

	// undefined module
	if (!module) {
		console.error('Action ' + request.route + '/' + request.action + ' not found')
		throw 'Action ' + request.route + '/' + request.action + ' not found'
	}

	// ActionClass module
	if (isAnyType(module)) {
		const action = (new module) as ActionObject
		if (request.format in action) {
			const need = needOf(action)
			if (
				need.alternative
				&& (need.alternative !== request.action)
				&& (
					((need.need === 'object') && !request.ids.length)
					|| ((need.need === 'Store') && !storeOf(request.type))
				)
			) {
				request.action = need.alternative
				return execute(request)
			}
			if ((need.need === 'object') && !request.ids.length && !request.request.data.confirm) {
				console.error('Action ' + request.route + '/' + request.action + ' needs at least one object')
				throw 'Action ' + request.route + '/' + request.action + ' needs at least one '
			}
			return toResponse(await action[request.format](request))
		}
	}

	// ActionFunction module
	return toResponse(await module(request))
}

export async function run()
{
	await loadRoutes(routes, config.routes ?? {})
	actionRequestDependsOn({
		getModule:      routes.resolve.bind(routes),
		isDomainObject: object => isAnyType(object) && !(object.prototype instanceof Action)
	})

	return new FastifyServer({
		assetPath:   appDir,
		execute:     request => execute(new Request(request)),
		favicon:     config.container?.favicon ?? normalize(join(__dirname, '../favicon.png')),
		frontScripts,
		host:        config.server.host,
		manifest:    config.container?.manifest,
		port:        config.server.port,
		scriptCalls: ['loadCss', 'loadScript'],
		secret:      config.session.secret ?? config.secret ?? 'defaultSecretHaving32CharactersOrGreater',
		secure:      config.server.secure ?? 'auto',
		store:       new FileStore(normalize(join(appDir, config.session.path)))
	}).run()
}

function toResponse(mixedResponse: Response | string)
{
	return (typeof mixedResponse === 'string')
		? new Response(mixedResponse)
		: mixedResponse
}
