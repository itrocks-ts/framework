# Authorised property metadata

The server subpath `@itrocks/framework/property-select` exposes `ReflectionMetadataProvider`, `MetadataError`,
`MetadataErrorCode`, `MetadataRoot`, `PropertySelectDependencies`,
`createMetadataProvider`, `metadataConfiguration`, `propertySelectDependsOn` and `bindPropertySelect`.
Normal bootstrap binds its routes after reflection composition. `ReflectionMetadataProvider` implements the
`MetadataProvider` port from `@itrocks/property-select`.

## Routes and access

Every business class exposed by a route is available to the selector without a `propertySelect.roots` setting.
For example, a `/invoice` route to an `Invoice` class makes `/invoice` the selector root. The framework resolves
that URL through `@itrocks/route` on each request; an unknown route or one resolving to an action is forbidden.
The browser never supplies a module destination or class name. The catalogue includes inherited fields and
accessible fields beyond the initial `List` columns.

The normal action access policy also applies to these routes. Add request-specific restrictions after framework
binding and before server startup, through `beforeFrameworkRun`:

```ts
import { propertySelectDependsOn } from '@itrocks/framework/property-select'

propertySelectDependsOn({
  authorise: async (request, root, path) => {
    return request.request.session.user?.metadataPaths?.[root]?.includes(path) ?? false
  }
})
```

The callback receives the current action request, the route URL and every traversed prefix, including `''` for the
root. It must grant root and ancestor navigation as well as the destination. Its default permits every routed
business class under the existing action access policy. There is no global cache of user access decisions.
Partial dependency binding preserves unspecified defaults. Both enumeration and complete-path resolution apply
these same checks before resolving forbidden prefixes. Unknown roots and denied paths return an identical
`403 { error: 'forbidden' }` response.

An optional `advice(request, root)` dependency may return suggested relation paths. The framework validates each
suggestion against the same access policy before sending it to the browser. No advice is required for availability.

`createMetadataProvider(request, root?)` constructs a provider for that request and route URL; `root` defaults to
`request.route`. Direct construction accepts a root map and an asynchronous `(root, path) => boolean` policy, useful
for adapters with another request abstraction. Direct root maps may narrow paths without changing framework routes.
It requires the usual framework reflection composition before use; missing composition fails explicitly.
Framework `ReflectClass.propertyNames` enumerates declared types and prototype getter descriptors without
constructing domain records. Metadata uses declared property types, never getters or property values.

## Metadata and presentation

`context(root, path, signal?)` returns one object's authorised properties, with full root-relative paths.
`resolve(root, '', signal?)` returns that root context; another path returns one property description.
Functional groups come from `groupOf(target)` in `@itrocks/property-group`. Each group contains its stable name,
translated label and authorised full property paths; empty groups are omitted. Inherited and property-level
`@Group` declarations use the same accessor.
Relations marked `@Component` or [`@Expand`](https://github.com/itrocks-ts/property-expand) receive `component: true`.
The selector presents both as identical groups of authorised child properties. `@Expand` only requests expansion;
it does not declare composition, change cardinality or infer an ownership inverse.
Labels and order reuse `class-view` and `property-view`, with technical-name fallbacks. Order gaps after permission
filtering retain the original business order. Host translation remains separate.

Type and relation identities are opaque hashes of server-side class metadata identities; no module path is sent.
Inherited relations have the identity of their declaring metadata owner, regardless of the traversal path.
Logical inverses and N-N targets are navigable without exposing or loading link tables. Explicit relation facts
come from reflection. Component/composite declarations add an inverse only when exactly one opposite ownership
property matches; cardinality is inferred only for a known singular/plural pair. Unknown facts remain unknown.
Native `Date` properties, including nullable and optional dates, are terminal and remain selectable.
Requesting a known terminal property as a context rejects with `MetadataError('invalid-path')`. Native Date method
traversal also rejects as `invalid-path`. Both become HTTP `400 { error: 'invalid-path' }`,
without enumerating native classes.
Ambiguous traversal, missing properties, terminal traversal and unknown targets reject explicitly.

Both methods honour `AbortSignal` before work and after awaited policy decisions. They load no business records,
perform no SQL and never read `ReflectProperty.value`. Lazy search and cycle-return decisions belong to the selector.

## Actions and browser transport

The real framework actions expose these GET endpoints:

- `/property-select/context/json?root=%2Finvoice&path=customer.address`
- `/property-select/resolve/json?root=%2Finvoice&path=customer.address.city.name`
- `/property-select/configuration/json?root=%2Finvoice`

Responses are JSON with `Cache-Control: no-store`. Invalid requests or paths return `400`; denied access returns `403`.
The configuration response contains only authorised, valid relation advice and catalogue version `1`.
Advice comes from the optional dependency; the adapter has no recommendation or persistence engine.

The public browser subpath `@itrocks/framework/property-select-metadata.js` exports `HttpMetadataProvider` and
`MetadataTransportOptions`. The normal browser composition root exposes the adapter and registers its asset.
Its import has no activation or server side effect:

```ts
import { HttpMetadataProvider } from '@itrocks/framework/property-select-metadata.js'

const metadata = new HttpMetadataProvider()
const context = await metadata.context('/invoice', '')
const configuration = await metadata.configuration('/invoice')
```

Options accept `endpoint` (default `/property-select`), a substitutable `fetch` function and an optional
`initial: { root, contexts, errors }` snapshot. The snapshot supplies authorised metadata for the current list response.
Requests use same-origin credentials and forward `AbortSignal`. A cancelled response is also checked after JSON
parsing. The selector's generation checks discard obsolete responses even when the network cannot be interrupted.
Session restoration, rendered controls, searching and host column integration belong to their respective adapters.

## Verification

`npm test` rebuilds the package and exercises existing framework tests plus metadata contracts.
`node --test --test-isolation=none` with the absolute `test/property-select-metadata.test.mjs` path gives individual
META assertions. The isolated test fixture and `test/metadata-browser.mjs` exercise the public browser module and
real request adapter, including cancellation, stale results, per-request permission changes and zero business reads.
These test resources are outside the published runtime.

## List and pane composition

The browser composition listens for the configured container's `itrocks:right-pane-ready` event, whose detail exposes
`register(owner, content, title)`. `itrocks:right-pane-request` requests replay when consumers load after the container.
The public `bindListPane(registration)` at `@itrocks/framework/property-select-list.js` also accepts that structurally
compatible callback directly. Framework and list import no home implementation. A container without this port mounts
no list selector.

List build activation announces `itrocks:list-ready` with its public table addition adapter and configuration saver.
Only articles carrying an authorised `data-property-root` mount the selector. Dynamic navigation disposes detached
views, aborts their pending requests and removes their pane registration. Metadata requests use `HttpMetadataProvider`;
list requests keep their own scope, data source and projection/rendering responsibility.

Server binding uses the list's route URL and verifies its resolved business class, including anonymous wrappers.
The same per-request metadata policy authorises projection paths and every representative dependency, before querying.
The `/property-select/template/html` action serves only the selector's exported HTML fragment. It does not enable
arbitrary HTML asset access. The view's optional template URL allows this transport while standalone hosts retain the
adjacent static template. Neither the view nor list imports server framework code.

The list access adapter supplies a request-scoped bootstrap. `metadataBootstrap(request, root, usedPaths, record)`
prepares the contexts needed by the restored branch, suggestions and bounded saved search, together with the selector
template and validated state. No business records are read. List adds the authoritative session revision and generation
to its encoded `data-selector-bootstrap` attribute. The browser consumes this response without configuration,
metadata, template or state requests on mount. New navigation and searches can fetch additional contexts lazily.
Column removal and reordering reuse existing contexts and cells; only configuration persistence requires a request.
