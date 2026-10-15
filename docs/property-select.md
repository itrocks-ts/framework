# Authorised property metadata

The server subpath `@itrocks/framework/property-select` exposes `ReflectionMetadataProvider`, `MetadataError`,
`MetadataErrorCode`, `MetadataRoot`, `PropertySelectConfiguration`, `PropertySelectDependencies`,
`createMetadataProvider`, `metadataConfiguration`, `propertySelectDependsOn` and `bindPropertySelect`.
Normal bootstrap binds its routes after reflection composition. `ReflectionMetadataProvider` implements the
`MetadataProvider` port from `@itrocks/property-select`.

## Configuration and access

No metadata root is available by default. Register each permitted business root in application configuration:

```yaml
propertySelect:
  roots:
    invoice:
      type: '/business/invoice:Invoice'
      version: '1'
      advice:
        - customer.address
      paths:
        - number
        - customer.address.city.name
```

`type` is a configured module destination with optional export name, or a class supplied by an initializer.
A leading `/` denotes the application directory; package destinations use their public module specifier.
The request supplies an opaque registered root id; it cannot supply a module or class name.
Omitting `paths` permits the root's reflected catalogue. An explicit list grants those complete paths and their
navigation prefixes. It does not grant every descendant of a relation. The catalogue includes inherited fields
and accessible fields beyond the initial `List` columns. Increment `version` when its grants or metadata change;
recreate a cached selector instance when switching catalogue snapshots.

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

The callback receives the current action request and every traversed prefix, including `''` for the root.
It must grant root and ancestor navigation as well as the destination. Its default permits configured roots and
paths under the existing action access policy. There is no global cache of user access decisions.
Partial dependency binding preserves unspecified defaults. Both enumeration and complete-path resolution apply
these same checks before resolving forbidden prefixes. Unregistered roots and denied paths return an identical
`403 { error: 'forbidden' }` response.

`createMetadataProvider(request)` constructs a provider for that request. Direct construction accepts a root map
and an asynchronous `(root, path) => boolean` policy, useful for adapters with another request abstraction.
It requires the usual framework reflection composition before use; missing composition fails explicitly.
Framework `ReflectClass.propertyNames` enumerates declared types and prototype getter descriptors without
constructing domain records. Metadata uses declared property types, never getters or property values.

## Metadata and presentation

`context(root, path, signal?)` returns one object's authorised properties, with full root-relative paths.
`resolve(root, '', signal?)` returns that root context; another path returns one property description.
Labels and order reuse `class-view` and `property-view`, with technical-name fallbacks. Order gaps after permission
filtering retain the original business order. Host translation remains separate.

Type and relation identities are opaque hashes of server-side class metadata identities; no module path is sent.
Inherited relations have the identity of their declaring metadata owner, regardless of the traversal path.
Logical inverses and N-N targets are navigable without exposing or loading link tables. Explicit relation facts
come from reflection. Component/composite declarations add an inverse only when exactly one opposite ownership
property matches; cardinality is inferred only for a known singular/plural pair. Unknown facts remain unknown.
Ambiguous traversal, missing properties, terminal traversal and unknown targets reject explicitly.

Both methods honour `AbortSignal` before work and after awaited policy decisions. They load no business records,
perform no SQL and never read `ReflectProperty.value`. Lazy search and cycle-return decisions belong to the selector.

## Actions and browser transport

The real framework actions expose these GET endpoints:

- `/property-select/context/json?root=invoice&path=customer.address`
- `/property-select/resolve/json?root=invoice&path=customer.address.city.name`
- `/property-select/configuration/json?root=invoice`

Responses are JSON with `Cache-Control: no-store`. Invalid requests or paths return `400`; denied access returns `403`.
The configuration response contains only authorised, valid relation advice and the configured catalogue version.
Advice is static root configuration; the adapter has no recommendation or persistence engine.

The public browser subpath `@itrocks/framework/property-select-metadata.js` exports `HttpMetadataProvider` and
`MetadataTransportOptions`. The normal browser composition root exposes the adapter and registers its asset.
Its import has no activation or server side effect:

```ts
import { HttpMetadataProvider } from '@itrocks/framework/property-select-metadata.js'

const metadata = new HttpMetadataProvider()
const context = await metadata.context('invoice', '')
const configuration = await metadata.configuration('invoice')
```

Options accept `endpoint` (default `/property-select`) and a substitutable `fetch` function.
Requests use same-origin credentials and forward `AbortSignal`. A cancelled response is also checked after JSON
parsing. The selector's generation checks discard obsolete responses even when the network cannot be interrupted.
Session restoration, rendered controls, searching and host column integration belong to their respective adapters.

## Verification

`npm test` rebuilds the package and exercises existing framework tests plus metadata contracts.
`node --test --test-isolation=none` with the absolute `test/property-select-metadata.test.mjs` path gives individual
META assertions. The isolated test fixture and `test/metadata-browser.mjs` exercise the public browser module and
real request adapter, including cancellation, stale results, per-request permission changes and zero business reads.
These test resources are outside the published runtime.
