import assert            from 'node:assert/strict'
import { mkdtemp }       from 'node:fs/promises'
import { rm }            from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir }        from 'node:os'
import { join }          from 'node:path'
import { test }          from 'node:test'

const require = createRequire(import.meta.url)
const { appDir } = require('@itrocks/app-dir')
const { File } = require('@itrocks/class-file')
const { Display } = require('@itrocks/class-view')
const { config } = require('@itrocks/config')
const { CustomList } = require('@itrocks/custom-list')
const { listSessionChanged, listState, prepareListSession, replaceListState } = require('@itrocks/list/session-state')
const { Request } = require('@itrocks/request-response')
const { Route } = require('@itrocks/route')
const { bindCustomList, businessModulePath, customListContext } = require('../cjs/custom-list.js')

class Movie {}
Display('Movie')(Movie)
File(join(appDir, 'app/movie.js'))(Movie)
Route('/saved-movie-test')(Movie)

test('business module namespaces retain app or package paths and drop node_modules and extensions', () => {
	assert.equal(businessModulePath(join(appDir, 'app/movie.js')), 'app/movie')
	assert.equal(businessModulePath(join(appDir, 'node_modules/@itrocks/library/src/module.js')),
		'@itrocks/library/src/module')
})

test('the binding takes identity from the session and preserves the applied state through load and reset', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'framework-custom-list-'))
	try {
		config.dataPath = directory
		bindCustomList()
		const server = new Request('POST', 'http', 'localhost', 80, '/saved-movie-test/list', {}, {}, {}, {
			user: { id: 42, login: 'Alice' }
		})
		const request = { request: server, route: '/saved-movie-test', type: Movie, get data() { return server.data } }
		const state = { columns: ['title'], filter: { title: 'Alien', hidden: 'saved' }, sort: [['title', true]] }
		replaceListState(server, Movie, state)
		Object.assign(server.data, { name: 'My list', operation: 'save', user: '43', visibility: 'private' })
		assert.equal((await new CustomList().json(request)).statusCode, 200)
		const context = await customListContext(request)
		assert.deepEqual(context.user, { id: '42', name: 'Alice' })
		assert.equal(context.modulePath, 'app/movie')
		listSessionChanged(server, Movie)
		assert.equal(server.session.customLists[request.route].modified, true)
		replaceListState(server, Movie, { columns: [] })
		server.data.custom = 'my-list-42'
		assert.equal(await prepareListSession(request), undefined)
		assert.deepEqual(listState(server, Movie), state)
		assert.equal(server.session.customLists[request.route].modified, false)
		server.data.custom = ''
		await prepareListSession(request)
		assert.deepEqual(server.session.list[request.route], {})
		assert.deepEqual(server.session.customLists[request.route], { modified: false })
		delete server.session.user
		server.data.custom = 'my-list-42'
		const denied = await prepareListSession(request)
		assert.equal(denied.statusCode, 404)
		assert.deepEqual(server.session.list[request.route], {})
	}
	finally { delete config.dataPath; await rm(directory, { force: true, recursive: true }) }
})
