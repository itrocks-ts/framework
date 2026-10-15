import type { Request }                     from '@itrocks/action-request'
import { createMetadataProvider }           from '@itrocks/framework/property-select'
import { MetadataError }                    from '@itrocks/framework/property-select'
import type { MetadataErrorCode }           from '@itrocks/framework/property-select'
import type { MetadataRoot }                from '@itrocks/framework/property-select'
import { ReflectionMetadataProvider }       from '@itrocks/framework/property-select'
import type { MetadataProvider }            from '@itrocks/property-select'
import { Invoice }                          from './invoice'

const root: MetadataRoot = { advice: ['billing'], paths: ['billing.city.name'], type: Invoice, version: '1' }
const provider: MetadataProvider = new ReflectionMetadataProvider({ invoice: root }, async () => true)
const code: MetadataErrorCode = 'forbidden'
const error: Error = new MetadataError(code)
const factory: (request: Request) => MetadataProvider = createMetadataProvider
// @ts-expect-error A provider cannot load business records.
provider.read(Invoice, 1)
// @ts-expect-error Root grants contain technical paths, not classes or records.
const invalid: MetadataRoot = { paths: [Invoice], type: Invoice }
void [error, factory, invalid, provider]
