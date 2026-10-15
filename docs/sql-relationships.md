# SQL relationship binding

The public `@itrocks/framework/sql-relationships` subpath exports `bindSqlJoins`, `relationshipOf`,
`sqlRelationshipsDependsOn`, `SqlRelationshipDependencies`, `ColumnDefinition` and `TableDefinition`.
Importing this subpath does not bootstrap a server. Normal framework `bind()` calls `bindSqlJoins()` after composition.

`bindSqlJoins(): void` configures the public `sqlJoinDependsOn` port. Table definitions are domain types and column
definitions are framework reflected properties. Property enumeration uses type metadata without constructing records.
The adapter resolves targets through `ReflectProperty.relation` and multiplicity through `resolvePropertyPath`.
An optional or nullable property remains optional even when marked `Required`.
Optional ancestry propagates in the graph.
Unknown/ambiguous targets reject instead of being treated as scalar columns.

`relationshipOf(table, name, property): Relationship` supplies direct foreign keys using `columnOf` and `id`.
Inverse collections use the explicitly named singular back-reference or the unique matching `Composite` property.
An inverse identity may be a target property name or `TargetClass.property`, matching its exact declared class name.
Arbitrary catalogue identities need an explicit schema mapping. Several candidate composites reject as ambiguous.
A unique `Component`/`Composite` pair also supplies inverse/cardinality facts when undeclared.
Otherwise these facts remain unknown; collection multiplicity alone does not invent them.

Explicit N-N relations use the public MySQL `joinTableName` convention and renamed store names plus `_id` for link
columns, matching existing link operations. The target identity is `id`. Self-relations, colliding link column names,
and inverse 1-1 relations without an ownership direction require an explicit mapping. These cases never choose
an arbitrary back-reference or fabricate distinct columns.

`sqlRelationshipsDependsOn({ mappingOf })` merges partial adapter configuration, preserving omitted hooks.
`mappingOf(property): RelationshipMapping | undefined` defaults to `undefined`, which selects the conventions above.
A custom schema provides physical facts through this hook before constructing a graph:

```ts
import { sqlRelationshipsDependsOn } from '@itrocks/framework/sql-relationships'

sqlRelationshipsDependsOn({
	mappingOf: property => property.name === 'relatedInvoices' ? {
		leftColumn: 'id',
		rightColumn: 'id',
		through: { table: 'invoice_relation', leftColumn: 'source_id', rightColumn: 'target_id' }
	} : undefined
})
```

Mappings describe stored schema only; the hook does not change reflection multiplicity or authorise paths.
It can also map singular inverse 1-1 relationships with `{ leftColumn: 'id', rightColumn: 'owner_id' }`.
Schema-specific code owns these overrides; no physical table metadata is added to neutral reflection decorators.
The framework imports reusable contracts through public package entries. SQL rendering remains in `sql-join`;
criterion scopes, conversion, selection policy and hydration remain with their consumers.

Run `npm test` to build server/browser outputs and synthetic model fixtures, then execute existing bootstrap/language
checks and public relationship binding tests. Test fixtures contain no application records or database connections.
