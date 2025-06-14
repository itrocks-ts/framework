import { PropertyTypes }      from '@itrocks/property-type'
import { ReflectClass as RC } from '@itrocks/reflect'
import { usesOf }             from '@itrocks/uses'
import { ReflectProperty }    from './reflect-property'

export class ReflectClass<T extends object = object> extends RC<T>
{

	inheritedPropertyTypes(propertyTypes: PropertyTypes): void
	{
		super.inheritedPropertyTypes(propertyTypes)
		for (const uses of this.uses) {
			Object.assign(propertyTypes, new ReflectClass(uses).propertyTypes)
		}
	}

	get parent()
	{
		const parent = super.parent
		return parent
			? Object.setPrototypeOf(parent, ReflectClass.prototype)
			: parent
	}

	get properties()
	{
		const properties = super.properties
		for (const reflectProperty of properties) {
			Object.setPrototypeOf(reflectProperty, ReflectProperty.prototype)
		}
		return properties
	}

	get uses()
	{
		const value = usesOf(this.type)
		Object.defineProperty(this, 'uses', { configurable: true, enumerable: false, value, writable: true })
		return value
	}

}
