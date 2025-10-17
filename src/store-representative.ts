import { Type }                from '@itrocks/class-type'
import { representativeOf }    from '@itrocks/class-view'
import { Store as SuperStore } from '@itrocks/store'

export function Store(name: string | false = '')
{
	const callBack = SuperStore(name)
	return function (target: Type) {
		representativeOf(target)
		callBack(target)
	}
}
