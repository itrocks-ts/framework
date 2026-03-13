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

	get parent()
	{
		const parent = super.parent
			? Object.defineProperties(
				Object.create(ReflectClass.prototype),
				Object.getOwnPropertyDescriptors(super.parent)
			)
			: super.parent
		Object.defineProperty(this, 'parent', { configurable: true, enumerable: false, value: parent, writable: true })
		return parent
	}

	get properties()
	{
		const properties = super.properties
		for (const reflectProperty of properties) {
			Object.defineProperties(
				Object.create(ReflectProperty.prototype),
				Object.getOwnPropertyDescriptors(reflectProperty)
			)
		}
		Object.defineProperty(
			this, 'properties', { configurable: true, enumerable: false, value: properties, writable: true }
		)
		return properties
	}

	get property()
	{
		const properties = super.property
		for (const entry of Object.entries(properties)) {
			properties[entry[0] as keyof typeof properties] = Object.defineProperties(
				Object.create(ReflectProperty.prototype),
				Object.getOwnPropertyDescriptors(entry[1])
			)
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
