import { appDir }     from '@itrocks/app-dir'
import { existsSync } from 'node:fs'

export type Config = Record<string, any>

export function mergeConfig(config: Config, appConfigFile: string)
{
	if (!existsSync(appDir + appConfigFile)) return
	const appConfig = Object.values(require(appDir + appConfigFile))[0] as Record<string, any>
	Object.entries(appConfig).forEach(([key, value]) => {
		if (config[key]) {
			if (!Array.isArray(config[key])) config[key] = [config[key]]
			if (Array.isArray(value))        config[key].push(...value)
			else                             config[key].push(value as string)
		}
		else {
			config[key] = value as string | string[]
		}
	})
}
