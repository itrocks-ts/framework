import { appDir }         from '@itrocks/app-dir'
import { config }         from '@itrocks/config'
import { Request }        from '@itrocks/request-response'
import { trInit }         from '@itrocks/translate'
import { trLoad }         from '@itrocks/translate'
import { trWithLanguage } from '@itrocks/translate'
import { join }           from 'node:path'

type LanguageConfiguration = {
	defaultLanguage:    string
	supportedLanguages: string[]
}

let configuration: LanguageConfiguration = {
	defaultLanguage:    'fr-FR',
	supportedLanguages: ['fr-FR']
}
let loading = Promise.resolve<unknown>(undefined)

function canonicalLanguage(value: string): string | void
{
	try   { return Intl.getCanonicalLocales(value)[0] }
	catch { return }
}

export function configureLanguages()
{
	const options            = (config.translate ?? {}) as LanguageConfiguration
	const defaultLanguage    = canonicalLanguage(options.defaultLanguage) ?? 'fr-FR'
	const supportedLanguages = options.supportedLanguages
		.map(language => canonicalLanguage(language))
		.filter((language): language is string => !!language)
	if (!supportedLanguages.includes(defaultLanguage)) {
		supportedLanguages.push(defaultLanguage)
	}
	configuration = { defaultLanguage, supportedLanguages: [...new Set(supportedLanguages)] }

	trInit(defaultLanguage)

	loading = (async () => {
		// TODO search language files everywhere in application modules, not only into app
		const directories = [join(__dirname, '..'), join(appDir, 'app'), appDir]
		for (const language of configuration.supportedLanguages) {
			for (const directory of directories) {
				const file = join(directory, language + '.csv')
				await trLoad(file, language)
			}
		}
	})()
}

export function languageFromHeader(
	header: string | undefined,
	supportedLanguages = configuration.supportedLanguages,
	defaultLanguage    = configuration.defaultLanguage
): string
{
	const preferences = (header ?? '').split(',').map((item, index) => {
		const [range, ...parameters] = item.trim().split(';')
		const qualityParameter       = parameters.find(parameter => parameter.trim().startsWith('q='))
		const quality                = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1
		return { index, quality: Number.isFinite(quality) ? quality : 0, range }
	}).filter(preference => preference.range && (preference.quality > 0))
		.sort((left, right) => right.quality - left.quality || left.index - right.index)

	for (const preference of preferences) {
		if (preference.range === '*') return defaultLanguage
		const requested = canonicalLanguage(preference.range)
		if (!requested) continue
		const exact = supportedLanguages.find(language => language.toLowerCase() === requested.toLowerCase())
		if (exact) return exact
		const base       = requested.split('-')[0]!.toLowerCase()
		const compatible = supportedLanguages.find(language => language.split('-')[0]!.toLowerCase() === base)
		if (compatible) return compatible
	}
	return defaultLanguage
}

export function languageOf(request: Request): string
{
	const preferred = canonicalLanguage(request.session.language)
	if (preferred) {
		const supported = configuration.supportedLanguages.find(
			language => language.toLowerCase() === preferred.toLowerCase()
		)
		if (supported) return supported
	}
	return languageFromHeader(request.headers['accept-language'])
}

export async function withRequestLanguage<T>(request: Request, callback: () => T | Promise<T>): Promise<T>
{
	await loading
	return trWithLanguage(languageOf(request), callback)
}
