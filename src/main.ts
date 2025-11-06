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

type ActionObject   = Record<string, ActionFunction>
type ActionFunction = (request: Request) => Promise<Response>

frontScripts.push(
	'/node_modules/air-datepicker/locale/en.js',
	'/node_modules/air-datepicker/locale/fr.js'
)

async function execute(request: Request): Promise<Response>
{
	// Access control
	if (!request.request.session.user && !config.access.free.includes(request.route + '/' + request.action)) {
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
			return action[request.format](request)
		}
	}

	// ActionFunction module
	return module(request)
}

export async function run()
{
	await loadRoutes(routes, config.routes)
	actionRequestDependsOn({ getModule: routes.resolve.bind(routes) })

	return new FastifyServer({
		assetPath:   appDir,
		execute:     request => execute(new Request(request)),
		favicon:     '/node_modules/@itrocks/framework/favicon.ico',
		frontScripts,
		port:        3000,
		scriptCalls: ['loadCss', 'loadScript'],
		secret:      config.secret,
		store:       new FileStore(join(appDir, config.session.path))
	}).run()
}
