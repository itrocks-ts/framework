import { PropertyTypes }      from '@itrocks/property-type'
import { ReflectClass as RC } from '@itrocks/reflect'
import { usesOf }             from '@itrocks/uses'
import { ReflectProperty }    from './reflect-property'

export class ReflectClass<T extends object = object> extends RC<T>
{

	inheritPropertyTypes(propertyTypes: PropertyTypes<T>): void
	{
		super.inheritPropertyTypes(propertyTypes)
		for (const uses of this.uses) {
			Object.assign(propertyTypes, new ReflectClass(uses).propertyTypes)
		}
	}

	get parent() : ReflectClass | null
	{
		const parentType = Object.getPrototypeOf(this.type)
		const parent     = (parentType === Function.prototype) ? null : new ReflectClass(parentType)
		Object.defineProperty(this, 'parent', { configurable: true, enumerable: false, value: parent, writable: true })
		return parent
	}

	get properties()
	{
		const properties = new Array<ReflectProperty<T>>
		for (const name of this.propertyNames) {
			properties.push(new ReflectProperty(this, name))
		}
		Object.defineProperty(
			this, 'properties', { configurable: true, enumerable: false, value: properties, writable: true }
		)
		return properties
	}

	get property()
	{
		const properties = {} as { [K in keyof T]: ReflectProperty<T, K> }
		for (const property of this.properties) {
			properties[property.name] = property
		}
		Object.defineProperty(
			this, 'property', { configurable: true, enumerable: false, value: properties, writable: true }
		)
		return properties
	}

	get uses()
	{
		const value = usesOf(this.type)
		Object.defineProperty(this, 'uses', { configurable: true, enumerable: false, value, writable: true })
		return value
	}

}
