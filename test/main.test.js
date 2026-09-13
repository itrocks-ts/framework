const assert        = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path          = require('node:path')
const test          = require('node:test')

test('does not load main before the framework composition phase', () => {
	const child = spawnSync(process.execPath, ['-e', `
		const framework = require.resolve('./cjs/framework')
		const main      = require.resolve('./cjs/main')
		require(framework)
		process.exit(require.cache[main] ? 2 : 0)
	`], {
		cwd:      path.resolve(__dirname, '..'),
		encoding: 'utf8'
	})

	assert.equal(child.status, 0, child.stderr || child.stdout)
})
