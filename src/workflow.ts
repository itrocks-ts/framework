import { setAction }          from '@itrocks/action'
import { setActionCss }       from '@itrocks/action'
import { setActionTemplates } from '@itrocks/action'

export function build()
{
	setActionCss(
		{ file: '/node_modules/@itrocks/(action)/css/action.css' }
	)
	setActionTemplates(
		{ need: 'object', file: __dirname + '/../../action/cjs/selectionAction.html' },
		{ file: __dirname + '/../../action/cjs/action.html' }
	)
	setAction('edit',   'delete')
	setAction('login',  'forgot-password')
	setAction('login',  'signup', { caption: 'Sign up' })
	setAction('list',   'new')
	setAction('list',   'delete', { need: 'object' })
	setAction('output', 'edit')
	setAction('output', 'print', { target: undefined } )
	setAction('output', 'delete')
}
