import { mergeConfig } from './config'

export const accessConfig: Record<string, any> =
{
	free: [
		'/user/authenticate',
		'/user/forgot-password',
		'/user/login',
		'/user/signup'
	]
}

mergeConfig(accessConfig, '/app/config/access.js')
