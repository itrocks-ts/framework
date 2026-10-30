import { Request }                from '@itrocks/action-request'
import { appDir }                 from '@itrocks/app-dir'
import { fileOf }                 from '@itrocks/class-file'
import { trOutputOf }             from '@itrocks/class-view'
import { configPath }             from '@itrocks/config'
import { CustomList }             from '@itrocks/custom-list'
import type { CustomListContext } from '@itrocks/custom-list'
import { customListDependsOn }    from '@itrocks/custom-list'
import { CustomListError }        from '@itrocks/custom-list'
import { CustomLists }            from '@itrocks/custom-list'
import { setDataPath }            from '@itrocks/data-path'
import { listDependsOn }          from '@itrocks/list'
import { listSessionDependsOn }   from '@itrocks/list/session-state'
import { listState }              from '@itrocks/list/session-state'
import { replaceListState }       from '@itrocks/list/session-state'
import { Response }               from '@itrocks/request-response'
import { routeOf }                from '@itrocks/route'
import { tr }                     from '@itrocks/translate'
import { relative }               from 'node:path'

export function bindCustomList(): void
{
	setDataPath(configPath('dataPath', '../data'))
	customListDependsOn({
		context: customListContext,
		state: {
			read: request => listState(request.request, request.type),
			replace: (request, state) => replaceListState(request.request, request.type, state)
		}
	})
	listDependsOn({ view: request => new CustomList().breadcrumbView(request) })
	listSessionDependsOn({
		changed: (request, type) => {
			const key = routeOf(type)
			request.session.customLists ??= {}
			request.session.customLists[key] = { ...request.session.customLists[key], modified: true }
		},
		prepare: async request => {
			if (typeof request.data.custom !== 'string') return
			const lists = new CustomLists(await customListContext(request))
			try { await lists.load(request, request.data.custom) }
			catch (error) {
				if (!(error instanceof CustomListError)) throw error
				return new Response(tr(error.message), error.status, { 'Content-Type': 'text/plain; charset=utf-8' })
			}
		}
	})
}

export function businessModulePath(file: string): string
{
	const path = relative(appDir, file).replaceAll('\\', '/').replace(/\.(?:[cm]?js|ts)$/, '')
	return path.replace(/^node_modules\//, '')
}

export async function customListContext(request: Request): Promise<CustomListContext>
{
	const name = tr(await trOutputOf(request.type) + ' list')
	const user = request.request.session.user
	return {
		defaultName: name[0].toLocaleUpperCase() + name.slice(1),
		key:         request.route,
		modulePath:  businessModulePath(fileOf(request.type)),
		user:        (user?.id === undefined)
			? undefined
			: { id: String(user.id), name: String(user.login || user.id) }
	}
}
