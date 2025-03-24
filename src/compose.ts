import { mergeConfig } from './config'

export const composeConfig: Record<string, string | string[]> =
{
	'@itrocks/reflect:ReflectClass':    '/reflect-class',
	'@itrocks/reflect:ReflectProperty': '/reflect-property',
}

mergeConfig(composeConfig, '/app/config/compose.js')
