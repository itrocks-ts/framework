import { loadCss }               from '@itrocks/asset-loader/asset-loader.js'
import { autoFocus }             from '@itrocks/auto-focus/auto-focus.js'
import                                '@itrocks/auto-redirect/build.js'
import { breadcrumb }            from '@itrocks/breadcrumb/breadcrumb.js'
import { build }                 from '@itrocks/build/build.js'
import { collapse }              from '@itrocks/collapse/collapse.js'
import { containedAutoWidth }    from '@itrocks/contained-auto-width/contained-auto-width.js'
import { notification }          from '@itrocks/notifications/notifications.js'
import { notifications }         from '@itrocks/notifications/notifications.js'
import                                '@itrocks/real-viewport-height/real-viewport-height.js'
import { XTargetBeginEnd }       from '@itrocks/xtarget/begin-end.js'
import { buildXTarget }          from '@itrocks/xtarget/build.js'
import { XTargetSecureClick }    from '@itrocks/xtarget/secure-click.js'
import { XTargetComposite }      from '@itrocks/xtarget/composite.js'
import { XTargetDefaultTarget }  from '@itrocks/xtarget/default-target.js'
import { XTargetDefaultOptions } from '@itrocks/xtarget/xtarget.js'
import { XTargetHead }           from '@itrocks/xtarget/head.js'
import { XTargetHeadersSize }    from '@itrocks/xtarget/headers-size.js'
import { XTargetHistory }        from '@itrocks/xtarget/history.js'
import { XTargetHoldOn }         from '@itrocks/xtarget/hold-on.js'
import { XTargetMainTarget }     from '@itrocks/xtarget/main-target.js'
import { XTargetModifier }       from '@itrocks/xtarget/modifier.js'

let selector: string

selector = 'input[data-type=object], ul[data-type=objects] > li > input:not([type=hidden])'
build<HTMLInputElement>(selector, async input => {
	input.classList.add('autocomplete')
	loadCss('/@itrocks/autocomplete/autocomplete.css')
	new (await import('@itrocks/autocomplete/autocomplete.js')).AutoComplete(input)
	if (input.dataset.type !== 'object') {
		(await import('@itrocks/links/links.js')).links(input)
	}
})

build<HTMLHeadingElement>('main > * > h2, main > * > header > h2', breadcrumb)

build<HTMLButtonElement>('button.collapse', button => collapse(button, 'body'))

build<HTMLInputElement>('input[data-type=date]', async input =>
	(await import('@itrocks/air-datepicker/air-datepicker.js')).airDatePicker(input)
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
