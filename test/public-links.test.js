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
		await writeFile(file, `<!DOCTYPE html>
<html lang="en"><head><title>Customers</title></head><body>
<table data-link="/customer" data-property-root="/customer">
<tbody><tr><td data-href="/customer/1">Customer</td></tr></tbody>
</table></body></html>`)
		for (const prefix of ['', '/admin']) {
			const core = new Request('GET', 'https', 'example.test', 443, '/customer/list', {}, {}, {}, {}, undefined, prefix)
			const response = await new Action().htmlTemplateResponse({}, { request: core }, file)
			assert.equal(response.statusCode, 200)
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
