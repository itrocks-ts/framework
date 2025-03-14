import build                     from '../../../build/build.js'
import buildXTarget              from '../../../xtarget/build.js'
import XTargetBeginEnd           from '../../../xtarget/begin-end.js'
import XTargetComposite          from '../../../xtarget/composite.js'
import XTargetDefaultTarget      from '../../../xtarget/default-target.js'
import XTargetHead               from '../../../xtarget/head.js'
import XTargetHeadersSize        from '../../../xtarget/headers-size.js'
import XTargetHistory            from '../../../xtarget/history.js'
import XTargetMainTarget         from '../../../xtarget/main-target.js'
import XTargetModifier           from '../../../xtarget/modifier.js'
import { XTargetDefaultOptions } from '../../../xtarget/xtarget.js'
import autoFocus                 from '../../../auto-focus/auto-focus.js'
import                                '../../../auto-redirect/build.js'
import breadcrumb                from '../../../breadcrumb/breadcrumb.js'
import collapse                  from '../../../collapse/collapse.js'
import containedAutoWidth        from '../../../contained-auto-width/contained-auto-width.js'
import notification              from '../../../notifications/notifications.js'
import { notifications }         from '../../../notifications/notifications.js'
import                                '../../../real-viewport-height/real-viewport-height.js'

let selector: string

selector = 'input[data-type=object], ul[data-type=objects] > li > input'
build<HTMLInputElement>(selector, async input =>
	(await import('../../../autocompleter/autocompleter.js')).default(input)
)

build<HTMLHeadingElement>('main > * > h2, main > * > header > h2', breadcrumb)

build<HTMLButtonElement>('button.collapse', button => collapse(button, 'body'))

build<HTMLInputElement>('input[data-type=date]', async input =>
	(await import('../../../air-datepicker/air-datepicker.js')).default(input)
)

build<HTMLFormElement>('form', autoFocus)

selector = '[data-contained-auto-width], [data-multiple-contained-auto-width] > li'
build<HTMLLIElement>(selector, async container => containedAutoWidth(container))

build<HTMLElement>('#notifications > li', notification)
build<HTMLOListElement>('#notifications', notifications)

XTargetDefaultOptions({ plugins: [
	XTargetBeginEnd, XTargetComposite, XTargetDefaultTarget, XTargetHead, XTargetHeadersSize, XTargetHistory,
	XTargetMainTarget, XTargetModifier
] })
buildXTarget()
