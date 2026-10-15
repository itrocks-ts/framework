# SQL projection composition

The public `@itrocks/framework/sql-projection` subpath exports `bindSqlProjection(): void` without bootstrapping a
server. Main framework `bind()` calls this same function after transformer initialisation.

```ts
import { bindSqlProjection } from '@itrocks/framework/sql-projection'

bindSqlProjection()
```

The binding connects MySQL read/save callbacks to the existing `SQL`/`READ` and `SQL`/`SAVE` transformer registry,
with the supplied final owner object, local property name and local raw record. It preserves lazy-property protection
handling. The adapter creates partial projection objects and handles ignored fields; the binding performs no reads.
Applications register custom property/type transformers through the public transformer package before projection.

The binding also supplies `toColumn` to sql-build and calls the public
[relationship binding](sql-relationships.md). Model stores and types remain with their existing metadata owners.
Ambiguous, unknown and invalid reflection paths are translated into relationship errors at the SQL boundary, then
into the neutral selection errors by MySQL. Directly stored scalar object fields use the builder's metadata default.

See [MySQL dependency configuration](https://github.com/itrocks-ts/mysql/blob/main/docs/dependencies.md) for the
consumer-owned callbacks and [storage](https://github.com/itrocks-ts/storage) for the partial result contract.
