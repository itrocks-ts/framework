const assert                      = require('node:assert/strict')
const { compose }                 = require('@itrocks/compose')
const { configuredFastifyServer } = require('../cjs/main')
const path                        = require('node:path')
const test                        = require('node:test')

test('resolves the configured server after composition', () => {
	compose(path.resolve(__dirname, '..'), {
		'@itrocks/fastify:FastifyServer': '/test/fastify-server.js:TestFastifyServer'
	})

	assert.equal(configuredFastifyServer().name, 'TestFastifyServer')
})
