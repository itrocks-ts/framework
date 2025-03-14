import { mergeConfig } from './config'

export const composeConfig: Record<string, string | string[]> =
{
	'@itrocks/reflect:ReflectClass':    '/class',
	'@itrocks/reflect:ReflectProperty': '/property',
}

mergeConfig(composeConfig, '/app/config/compose.js')
