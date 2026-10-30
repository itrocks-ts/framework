# Framework dependency binding

The server composition root is `src/dependencies.ts:bind()`, invoked after configured export composition.
The framework supplies adapters to consumer-owned contracts through public package entries.

## Property metadata

`propertySelectDependsOn(overrides: Partial<PropertySelectDependencies>)`, exported from
`@itrocks/framework/property-select`, merges overrides without removing unspecified defaults.
Its `authorise(request, root, path)` function returns a boolean or a promise of one. The default returns true for
every routed business class under the existing framework action access policy. The root is that class's route URL,
such as `/invoice`; no separate selector registration is needed. Each action gets its own request-bound provider;
user access is never cached globally. The adapter checks the root and all ancestor prefixes before resolving a
complete path. Optional `advice(request, root)` returns suggested relation paths; its default is empty.

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
freeze their reflection defaults. See [authorised metadata](property-select.md) for route-backed roots, advice, DTOs
and browser use.

## SQL adapters

[Relationship bindings](sql-relationships.md) map schema/reflection facts to `sql-join`.
[Projection bindings](sql-projection.md) supply final-owner SQL conversions to MySQL and SQL builders.
These bindings own persistence metadata; the property metadata provider does not query these adapters.

## Saved lists and application data

`bindCustomList()` in `src/custom-list.ts` connects [`custom-list`](../../custom-list/README.md) to the
[`list session port`](../../list/README.md#session-state-integration).
`context` resolves the translated default label, route key, business module file path and current session user.
`state.read` and `state.replace` delegate to `listState` and `replaceListState`.
The list's preparation callback loads explicit `custom` query values before rendering;
an empty value restores the default. Settings changes mark the active name modified.

The browser shell keeps a small context adapter. It imports `@itrocks/custom-list/custom-list.js` on the first list or
record heading and binds the pending-write dependency. The server includes `CustomList.breadcrumbView(request)`
through `listDependsOn({ view })`. On list pages the shell applies that template directly, skipping the ordinary
breadcrumb updater and any follow-up request. Column-only changes update the modified marker locally.
Record headings use the ordinary breadcrumb updater and its saved-list enrichment.
Modal behaviour stays in the modal templates' `build.js` dependency; it is not imported by the shell.
The package itself never imports the framework or binds host dependencies on its own.
The table's `settled` callback waits for pending column writes before loading or saving settings.
`itrocks:list-change` refreshes the modification marker after column persistence.
Anonymous saved-list actions share the business list's configured access policy; file writes additionally enforce
signed-in user and ownership rules in `custom-list`.

[`data-path`](../../data-path/README.md) receives `configPath('dataPath', '../data')` from
[`config`](../../config/README.md). Relative paths resolve against the declaring YAML file:

```yaml
dataPath: ../data/
```

The framework loads `custom-list` translations before its own and application catalogues.
