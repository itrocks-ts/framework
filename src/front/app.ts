import { autoFocus } from '@itrocks/auto-focus/auto-focus.js'
import                                '@itrocks/auto-redirect/build.js'
import { breadcrumb }         from '@itrocks/breadcrumb/breadcrumb.js'
import { build }              from '@itrocks/build/build.js'
import { collapse }           from '@itrocks/collapse/collapse.js'
import                                '@itrocks/edit-components/build.js'
import                                '@itrocks/form-controls/browser/build.js'
import { notification }       from '@itrocks/notifications/notifications.js'
import { notifications }      from '@itrocks/notifications/notifications.js'
import                                '@itrocks/real-viewport-height/real-viewport-height.js'
import { XTargetBeginEnd }       from '@itrocks/xtarget/begin-end.js'
import { buildXTarget }          from '@itrocks/xtarget/build.js'
import { XTargetComposite }      from '@itrocks/xtarget/composite.js'
import { XTargetDefaultTarget }  from '@itrocks/xtarget/default-target.js'
import { XTargetHead }           from '@itrocks/xtarget/head.js'
import { XTargetHeadersSize }    from '@itrocks/xtarget/headers-size.js'
import { XTargetHistory }        from '@itrocks/xtarget/history.js'
import { XTargetHoldOn }         from '@itrocks/xtarget/hold-on.js'
import { XTargetMainTarget }     from '@itrocks/xtarget/main-target.js'
import { XTargetModifier }       from '@itrocks/xtarget/modifier.js'
import { XTargetSecureClick }    from '@itrocks/xtarget/secure-click.js'
import { XTargetDefaultOptions } from '@itrocks/xtarget/xtarget.js'

import { enhanceListBreadcrumb } from './custom-list.js'
import './property-select-list.js'

build<HTMLHeadingElement>('main > * > h2, main > * > header > h2', heading => {
	if (!enhanceListBreadcrumb(heading)) breadcrumb(heading)
})

build<HTMLButtonElement>('button.collapse', button => collapse(button, 'body'))

build<HTMLFormElement>('form', autoFocus)

build<HTMLElement>('#notifications > li', notification)
build<HTMLOListElement>('#notifications', notifications)

XTargetDefaultOptions({ plugins: [
	XTargetBeginEnd, XTargetComposite, XTargetDefaultTarget, XTargetHead, XTargetHeadersSize,
	XTargetHistory, XTargetHoldOn, XTargetMainTarget, XTargetModifier, XTargetSecureClick
] })
buildXTarget()

export { HttpMetadataProvider } from './property-select-metadata.js'
