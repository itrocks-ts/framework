# Framework dependency binding

The server composition root is `src/dependencies.ts:bind()`, invoked after configured export composition.
The framework supplies adapters to consumer-owned contracts through public package entries.

## Property metadata

`propertySelectDependsOn(overrides: Partial<PropertySelectDependencies>)`, exported from
`@itrocks/framework/property-select`, merges overrides without removing unspecified defaults.
Its `authorise(request, root, path)` function returns a boolean or a promise of one. The default returns true for
explicitly configured roots and their configured path grants, under the existing framework action access policy.
No roots are configured by default. Each new action gets its own request-bound provider; user access is never cached
globally. The adapter checks the root and all ancestor prefixes before resolving a complete path.

Applications supply policy after composition and dependency binding, before requests start:

```ts
import { propertySelectDependsOn } from '@itrocks/framework/property-select'

propertySelectDependsOn({
  authorise: async (request, root, path) => {
    const grants = request.request.session.user?.metadataPaths?.[root] ?? []
    return grants.includes(path)
  }
})
```

The policy receives a transport-neutral action `Request`; application user/session semantics stay with the host.
For another request abstraction, construct `ReflectionMetadataProvider(roots, authorise)` with an asynchronous
`(root, path) => boolean` callback after reflection composition. Neither callback loads records for the selector.

`bindPropertySelect()` registers the framework actions. Reflection and path facts come from the public
[`reflect`](../../reflect/README.md) and [`reflect-path`](../../reflect-path/README.md) entries.
Presentation uses [`class-view`](../../class-view/README.md) labels and
[`property-view`](../../property-view/README.md) labels/order. Module destinations use
[`route`](../../route/README.md#api); the HTTP adapter uses `Action.jsonResponse` and `Request.data`.
Presentation/path owners are loaded when used, after export composition, so importing the binding API early does not
freeze their reflection defaults. See [authorised metadata](property-select.md) for roots, advice, DTOs and browser use.

## SQL adapters

[Relationship bindings](sql-relationships.md) map schema/reflection facts to `sql-join`.
[Projection bindings](sql-projection.md) supply final-owner SQL conversions to MySQL and SQL builders.
These bindings own persistence metadata; the property metadata provider does not query these adapters.
