const assert                 = require('node:assert/strict')
const test                   = require('node:test')
const { languageFromHeader } = require('../cjs/language')

test('selects an exact or compatible supported browser language', () => {
	const supported = ['en-US', 'fr-FR']

	assert.equal(languageFromHeader('fr-CA,fr;q=0.9,en;q=0.7', supported, 'en-US'), 'fr-FR')
	assert.equal(languageFromHeader('en-GB;q=0.8,fr-FR;q=0.6', supported, 'fr-FR'), 'en-US')
	assert.equal(languageFromHeader('de-DE,*;q=0.5', supported, 'fr-FR'), 'fr-FR')
	assert.equal(languageFromHeader('de-DE', supported, 'fr-FR'), 'fr-FR')
})
