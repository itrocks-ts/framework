const assert        = require('node:assert/strict')
const { mkdtemp }   = require('node:fs/promises')
const { rm }        = require('node:fs/promises')
const { writeFile } = require('node:fs/promises')
const { tmpdir }    = require('node:os')
const { join }      = require('node:path')
const test          = require('node:test')

const { Action }  = require('@itrocks/action')
const { config }  = require('@itrocks/config')
const { Request } = require('@itrocks/request-response')
const { bind }    = require('../cjs/dependencies')

test('table navigation follows the request mount while model identifiers keep their application paths', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'framework-public-links-'))
	const previousContainer = config.container
	try {
		config.container = {}
		bind()
		const file = join(directory, 'list.html')
		const container = join(directory, 'container.html')
		await writeFile(container, '<!DOCTYPE html><html><head><base href="/"></head><body>{content}</body></html>')
		await writeFile(file, `<!DOCTYPE html>
<html lang="en"><head><title>Customers</title><link href="/customer/theme.css" rel="stylesheet"></head><body>
<!--BEGIN-->
<table data-link="/customer" data-property-root="/customer">
<tbody><tr><td data-href="/customer/1">Customer</td></tr></tbody>
</table>
{control}
<!--END-->
</body></html>`)
		config.container.file = require('node:path').relative(require('@itrocks/app-dir').appDir, container)
		for (const prefix of ['', '/admin', '/customer']) {
			const core = new Request('GET', 'https', 'example.test', 443, '/customer/list', {}, {}, {}, {}, undefined, prefix)
			const data = { control: '<a href="/customer">Customers</a>' }
			const response = await new Action().htmlTemplateResponse(data, { request: core }, file)
			assert.equal(response.statusCode, 200)
			assert.ok(response.body.includes('<base href="' + prefix + '/">'))
			assert.ok(response.body.includes('href="' + prefix + '/customer/theme.css"'))
			assert.ok(response.body.includes('<a href="' + prefix + '/customer">'))
			assert.ok(response.body.includes('data-link="' + prefix + '/customer"'))
			assert.ok(response.body.includes('data-href="' + prefix + '/customer/1"'))
			assert.ok(response.body.includes('data-property-root="/customer"'))
		}
	}
	finally {
		config.container = previousContainer
		await rm(directory, { force: true, recursive: true })
	}
})
