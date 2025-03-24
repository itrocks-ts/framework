import { appDir }     from '@itrocks/app-dir'
import { existsSync } from 'node:fs'

export type Config = Record<string, any>

function mergeConfigObject(config: Config, mergeConfig: Config)
{
	Object.entries(mergeConfig).forEach(([key, value]) => {
		if (config[key]) {
			mergeConfigObject(config[key], value)
		}
		else {
			config[key] = value
		}
	})
}

export function mergeConfig(config: Config, appConfigFile: string)
{
	if (!existsSync(appDir + appConfigFile)) return
	mergeConfigObject(config, Object.values(require(appDir + appConfigFile))[0] as Config)
	console.log('Merged config', config)
}
