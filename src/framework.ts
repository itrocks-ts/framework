import '@itrocks/class-file/automation'

import { compose }         from '@itrocks/compose'
import { config }          from '@itrocks/config'
import { scanConfigFiles } from '@itrocks/config'

export { ReflectClass }    from './reflect-class'
export { ReflectProperty } from './reflect-property'

scanConfigFiles().then(() => {
	compose(__dirname, config.compose)
	require('@itrocks/default-action-workflow').build()
	require('./dependencies').bind()
	require('./main').run()
})
