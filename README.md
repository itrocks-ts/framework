[![npm version](https://img.shields.io/npm/v/@itrocks/framework?logo=npm)](https://www.npmjs.org/package/@itrocks/framework)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/framework)](https://www.npmjs.org/package/@itrocks/framework)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/framework?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/framework)
[![issues](https://img.shields.io/github/issues/itrocks-ts/framework)](https://github.com/itrocks-ts/framework/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# it.rocks framework

RAD framework for intuitive web application development, blending data and domain-driven design with modular architecture.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/framework
```

In a typical it.rocks application you install the framework together with
the modules that provide your domain model, actions and UI pieces. The
framework itself focuses on wiring everything together.

## Usage

Importing `@itrocks/framework` has two main effects:

- it boots the framework at runtime (composition of modules, configuration
  loading, HTTP server and main loop),
- it exposes enhanced reflection helpers `ReflectClass` and
  `ReflectProperty` that integrate with the rest of the it.rocks
  ecosystem.

Most of the time you do **not** import low‑level files from this package
directly. Instead you:

1. Start your application by importing the compiled entry point
   `@itrocks/framework/cjs/framework.js` (or the plain `@itrocks/framework`
   export from Node when appropriate).
2. Use `ReflectClass` / `ReflectProperty` from `@itrocks/framework` when you
   need reflection that understands it.rocks‑specific concepts such as
   `uses` and HTML transformers.

### Minimal bootstrap example

The simplest way to start an it.rocks application is to import the
framework once at startup. It will:

- scan configuration files (`config.yaml`, `local.yaml`) of your
  application and its dependencies,
- compose all registered modules (actions, routes, templates, stores,
  transformers, …),
- build the default action workflow,
- bind framework dependencies,
- run the main server loop.

```ts
// index.ts
import '@itrocks/framework'

// Import your application modules so that their configuration, actions
// and templates are discovered during composition.
import '@itrocks/home'
import './src/domain'
```

When this file is executed with Node (after TypeScript compilation), the
framework starts automatically and exposes your routes and actions.

### Using framework reflection helpers

`ReflectClass` and `ReflectProperty` behave like their counterparts from
`@itrocks/reflect`, but they add framework‑level knowledge:

- `ReflectClass` understands mixins declared through `@itrocks/uses` and
  merges their property types,
- `ReflectProperty` is able to render property values using
  transformers from `@itrocks/transformer` and
  `@itrocks/core-transformers`.

```ts
import type { ObjectType }              from '@itrocks/class-type'
import { ReflectClass }                 from '@itrocks/framework'
import { EmailAddress, emailAddressOf } from '@itrocks/email-address'

class User {
  @EmailAddress()
  email = ''

  name = ''
}

async function renderUserSummary(user: User) {
  const reflectClass = new ReflectClass<User>(User as ObjectType<User>)
  const properties   = reflectClass.properties

  const result: Record<string, string> = {}

  for (const property of properties) {
    const isEmail = emailAddressOf(User, property.name as keyof User)
    const value   = await property.output()

    result[property.name] = isEmail ? `<a href="mailto:${value}">${value}</a>` : String(value ?? '')
  }

  return result
}
```

In this example:

- `ReflectClass` gives you `ReflectProperty` instances rather than the
  bare properties from `@itrocks/reflect`,
- each `ReflectProperty` can render its value using configured
  transformers (`property.output()`),
- you can combine metadata from other packages (like
  `@itrocks/email-address`) to build higher‑level behaviour.

## API

`@itrocks/framework` exposes two main public symbols and the side‑effect
of bootstrapping the framework when its main module is imported.

### Framework bootstrap (side‑effect of importing `@itrocks/framework`)

When the compiled JavaScript entry point (`cjs/framework.js`) is loaded,
the following steps are executed:

1. `scanConfigFiles()` from `@itrocks/config` is called to build the
   global `config` object from all discovered `config.yaml` / `local.yaml`
   files.
2. The application composition is built with `compose()` from
   `@itrocks/compose`, wiring stores, actions, routes, templates and other
   components declared by installed modules.
3. `build()` from `@itrocks/default-action-workflow` is invoked to
   register the default actions workflow (list/new/delete, login/signup,
   output/edit/print/delete, …).
4. `bind()` from the local `dependencies` module wires framework
   dependencies (such as HTTP server, logging and storage bindings).
5. `run()` from the local `main` module starts the framework main loop
   (HTTP server and request handling in a typical application).

You normally do not call any of these functions directly. Importing the
module once at startup is enough to run your application, provided that
you have configured your routes and modules.

### `class ReflectClass<T extends object = object> extends RC<T>`

Enhanced reflection class that extends
`@itrocks/reflect:ReflectClass<T>` and adds framework‑specific
behaviour.

Typical usage:

```ts
import { ReflectClass } from '@itrocks/framework'

const reflectClass = new ReflectClass(SomeDomainClass)
```

#### Methods and properties

- `inheritedPropertyTypes(propertyTypes: PropertyTypes): void`

  Extends the base implementation by also merging property types coming
  from classes declared in the `uses` of the current type (via
  `@itrocks/uses`). This lets you treat mixin properties as if they were
  declared directly on the class.

- `get parent(): ReflectClass | undefined`

  Returns the parent `ReflectClass` if the current type inherits from
  another class. The parent is wrapped so that it also benefits from the
  framework‑specific methods.

- `get properties(): Iterable<ReflectProperty<T>>`

  Returns an iterable collection of `ReflectProperty<T>` instances, one
  for each property of the reflected class. All of them are upgraded to
  the `ReflectProperty` defined by this package.

- `property(name: KeyOf<T>): ReflectProperty<T>`

  Returns a single `ReflectProperty<T>` instance for the given property
  name. This is the preferred way to work with properties when you want
  to use framework helpers like `output()` and `edit()`.

- `get uses(): Type[]`

  Returns the list of mixin classes attached to the current type through
  `@itrocks/uses`. The result is cached on the instance.

### `class ReflectProperty<T extends object> extends RP<T>`

Enhanced property reflection class that extends
`@itrocks/reflect:ReflectProperty<T>` and knows how to call transformers
from `@itrocks/transformer` / `@itrocks/core-transformers` in the
context of the framework.

Typical usage:

```ts
import { ReflectClass } from '@itrocks/framework'

async function renderProperty(object: any, name: string) {
  const reflectClass    = new ReflectClass(object.constructor)
  const reflectProperty = reflectClass.property(name as never)
  return await reflectProperty.output()
}
```

#### Properties

- `get class: ReflectClass<T>`

  Returns the owning `ReflectClass` instance, upgraded from the base
  implementation so that it always exposes the framework‑aware
  `ReflectClass`.

#### Methods

- `async edit(format: string = HTML): Promise<any>`

  Applies the `EDIT` transformer chain to the property and returns the
  result, usually an HTML fragment representing an input field or an
  editable widget. You can change the `format` to use an alternative
  representation if you have registered other transformers.

- `async output(format: string = HTML, askFor?: HtmlContainer): Promise<any>`

  Applies the `OUTPUT` transformer chain to the property and returns the
  result (often an HTML fragment for display). The optional `askFor`
  `HtmlContainer` lets you drive how the output is wrapped.

- `async outputMandatoryContainer(format: string = HTML): Promise<any>`

  Convenience wrapper around `output()` that always wraps the result in
  a mandatory `HtmlContainer`.

- `async outputOptionalContainer(format: string = HTML): Promise<any>`

  Convenience wrapper around `output()` that wraps the result in an
  optional `HtmlContainer`.

## Typical use cases

- Quickly bootstrap a full it.rocks web application by importing the
  framework once at startup; it takes care of configuration loading,
  module composition and action workflow wiring.
- Integrate multiple it.rocks modules (actions, routes, templates,
  storage, translations, UI components, …) without writing plumbing
  code.
- Use `ReflectClass` / `ReflectProperty` when you need to:
  - inspect domain models and their properties (including mixins),
  - generate forms and views using the configured transformers,
  - render property values consistently across your application.
- Build higher‑level tooling (CRUD generators, admin dashboards,
  documentation tools) on top of the reflection API exposed by the
  framework.
