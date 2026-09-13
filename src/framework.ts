import '@itrocks/class-file/automation'

import { compose }         from '@itrocks/compose'
import { config }          from '@itrocks/config'
import { scanConfigFiles } from '@itrocks/config'

export type FrameworkInitializer = () => Promise<void> | void

export { servers }         from './servers'

export { ReflectClass }    from './reflect-class'
export { ReflectProperty } from './reflect-property'

const initializers = new Array<FrameworkInitializer>()

export function beforeFrameworkRun(initializer: FrameworkInitializer): void
{
	initializers.push(initializer)
}

scanConfigFiles().then(async () => {
	const frameworkCompose = {
		'@itrocks/store:Store': '/store-representative:Store'
	}
	compose(__dirname, Object.assign(frameworkCompose, config.compose))
	require('@itrocks/default-action-workflow').build()
	require('./dependencies').bind()
	for (const initializer of initializers) await initializer()
	await require('./main').run()
})
