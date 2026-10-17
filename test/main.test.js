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

test('configured Template renders translated literals through the framework composition', () => {
	const child = spawnSync(process.execPath, ['-e', `
		const assert = require('node:assert/strict')
		async function verify()
		{
			const { config, scanConfigFiles } = require('@itrocks/config')
			await scanConfigFiles()
			const { compose } = require('@itrocks/compose')
			compose(process.cwd(), { '@itrocks/template:Template': config.compose['@itrocks/template:Template'] })
			const { Template } = require('@itrocks/template')
			assert.equal(new Template({}).doLiteral, true)
			const { trLoad, trWithLanguage } = require('@itrocks/translate')
			await trLoad('fr-FR.csv', 'fr-template-composition-test')
			const html = await trWithLanguage('fr-template-composition-test', () =>
				new Template({}).parseBuffer('<button title="Clear search">Clear search</button>'))
			assert.ok(html.includes('title="Effacer la recherche"'))
			assert.ok(html.includes('>Effacer la recherche</button>'))
		}
		verify().catch(error => { console.error(error); process.exitCode = 1 })
	`], {
		cwd:      path.resolve(__dirname, '..'),
		encoding: 'utf8'
	})

	assert.equal(child.status, 0, child.stderr || child.stdout)
})

test('composes Template before its first import during framework startup', () => {
	const child = spawnSync(process.execPath, ['-e', `
		const assert = require('node:assert/strict')
		const Module = require('node:module')
		const templateFile = require.resolve('@itrocks/template')
		const mainFile = require.resolve('./cjs/main')
		const composition = require('@itrocks/compose')
		const compose = composition.compose
		let composed = false, firstImporter
		composition.compose = (...args) => {
			assert.equal(require.cache[templateFile], undefined, 'Template loaded before composition')
			const result = compose(...args)
			composed = true
			return result
		}
		const load = Module._load
		Module._load = function(request, parent, isMain)
		{
			const filename = Module._resolveFilename(request, parent)
			if (filename === templateFile) {
				assert.equal(composed, true, 'Premature Template import from ' + parent.filename)
				firstImporter ??= parent.filename
			}
			if (filename === mainFile) return { run: async () => {
				assert.ok(firstImporter, 'Framework did not import Template')
				assert.equal(new (require('@itrocks/template').Template)({}).doLiteral, true)
				require('node:fs').writeSync(1, JSON.stringify({ firstImporter }))
				process.exit(0)
			} }
			return load.call(this, request, parent, isMain)
		}
		require('./cjs/framework')
	`], {
		cwd:      path.resolve(__dirname, '..'),
		encoding: 'utf8',
		timeout:  15000
	})

	assert.equal(child.status, 0, child.error?.message || child.stderr || child.stdout)
	assert.match(JSON.parse(child.stdout).firstImporter, /dependencies[.]js$/)
})
