import { ObjectOrType }          from '@itrocks/class-type'
import { HtmlContainer }         from '@itrocks/core-transformers'
import { ReflectProperty as RP } from '@itrocks/reflect'
import { applyTransformer }      from '@itrocks/transformer'
import { EDIT, HTML, OUTPUT }    from '@itrocks/transformer'
import { ReflectClass }          from './reflect-class'

type FormControl = <T extends object>(value: unknown, target: ObjectOrType<T>, property: keyof T)
	=> Promise<unknown>

let formControl: FormControl = (value, object, property) => applyTransformer(value, object, property, HTML, EDIT)

export function formControlDependsOn(render: FormControl): void
{
	formControl = render
}

export class ReflectProperty<T extends object, K extends keyof T = keyof T> extends RP<T, K>
{

	get class()
	{
		const value = super.class
		Object.defineProperty(this, 'class', { configurable: true, enumerable: false, value, writable: true })
		return value ? new ReflectClass<T>(value.object ?? value.type) : value
	}

	async edit(format: string = HTML): Promise<any>
	{
		const object = this.object ?? this.class.type
		const value  = this.object ? this.object[this.name] : undefined
		return (format === HTML)
			? formControl<T>(await value, object, this.name)
			: applyTransformer<T>(await value, object, this.name, format, EDIT)
	}

	async output(format: string = HTML, askFor?: HtmlContainer): Promise<any>
	{
		const object = this.object ?? this.class.type
		const value  = this.object ? await this.object[this.name] : undefined
		return applyTransformer<T>(value, object, this.name, format, OUTPUT, askFor)
	}

	async outputMandatoryContainer(format: string = HTML)
	{
		return this.output(format, new HtmlContainer(true))
	}

	async outputOptionalContainer(format: string = HTML)
	{
		return this.output(format, new HtmlContainer(false))
	}

}
