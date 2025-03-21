import { mergeConfig } from './config'

export const menuConfig: Record<string, Record<string, string>> =
{
	'Administration': {
		'/user/list': 'Users'
	}
}

mergeConfig(menuConfig, '/app/config/menu.js')
