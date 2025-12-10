import { loadCss }               from '../../../asset-loader/asset-loader.js'
import { autoFocus }             from '../../../auto-focus/auto-focus.js'
import                                '../../../auto-redirect/build.js'
import { breadcrumb }            from '../../../breadcrumb/breadcrumb.js'
import { build }                 from '../../../build/build.js'
import { collapse }              from '../../../collapse/collapse.js'
import { containedAutoWidth }    from '../../../contained-auto-width/contained-auto-width.js'
import { notification }          from '../../../notifications/notifications.js'
import { notifications }         from '../../../notifications/notifications.js'
import                                '../../../real-viewport-height/real-viewport-height.js'
import { XTargetBeginEnd }       from '../../../xtarget/begin-end.js'
import { buildXTarget }          from '../../../xtarget/build.js'
import { XTargetSecureClick }    from '../../../xtarget/secure-click.js'
import { XTargetComposite }      from '../../../xtarget/composite.js'
import { XTargetDefaultTarget }  from '../../../xtarget/default-target.js'
import { XTargetDefaultOptions } from '../../../xtarget/xtarget.js'
import { XTargetHead }           from '../../../xtarget/head.js'
import { XTargetHeadersSize }    from '../../../xtarget/headers-size.js'
import { XTargetHistory }        from '../../../xtarget/history.js'
import { XTargetHoldOn }         from '../../../xtarget/hold-on.js'
import { XTargetMainTarget }     from '../../../xtarget/main-target.js'
import { XTargetModifier }       from '../../../xtarget/modifier.js'

let selector: string

selector = 'input[data-type=object], ul[data-type=objects] > li > input:not([type=hidden])'
build<HTMLInputElement>(selector, async input => {
	input.closest<HTMLLIElement>('li')?.classList.add('combobox')
	loadCss('/node_modules/@itrocks/autocomplete/autocomplete.css')
	return new (await import('../../../autocomplete/autocomplete.js')).AutoComplete(input)
})

build<HTMLHeadingElement>('main > * > h2, main > * > header > h2', breadcrumb)

build<HTMLButtonElement>('button.collapse', button => collapse(button, 'body'))

build<HTMLInputElement>('ul[data-type=objects] > .combobox > input:not([type=hidden])', async input =>
	(await import('../../../links/links.js')).links(input)
)

build<HTMLInputElement>('input[data-type=date]', async input =>
	(await import('../../../air-datepicker/air-datepicker.js')).airDatePicker(input)
)

build<HTMLFormElement>('form', autoFocus)

selector = '[data-contained-auto-width], [data-multiple-contained-auto-width] > li'
build<HTMLLIElement>(selector, async container => containedAutoWidth(container))

build<HTMLElement>('#notifications > li', notification)
build<HTMLOListElement>('#notifications', notifications)

XTargetDefaultOptions({ plugins: [
	XTargetBeginEnd, XTargetComposite, XTargetDefaultTarget, XTargetHead, XTargetHeadersSize,
	XTargetHistory, XTargetHoldOn, XTargetMainTarget, XTargetModifier, XTargetSecureClick
] })
buildXTarget()
