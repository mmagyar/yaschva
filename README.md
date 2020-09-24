[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
![Node.js CI](https://github.com/mmagyar/yaschva/workflows/Node.js%20CI/badge.svg?branch=master)
![Code coverage](https://img.shields.io/codecov/c/github/mmagyar/yaschva)

#### A simple validation library.
#### Using a concise definition, with safe defaults.

Playground
==========

There is an interactive playground, where yaschva can be test driven

[playground.yaschva.com](https://playground.yaschva.com)

Examples
========

Defining an object with a few properties is as simple this:
```json
{
  this helps your IDE to autocomplete the schema when writing it.
  ↓↓↓↓↓↓↓↓↓
  "$schema": "https://yaschva.com/schema.json",
  "username": "string",               <-- Username is a string
  "numberOfCats": "number",           <-- this is a number
  "favoriteCatName": ["?", "string"]  <-- this is an optional string
}
```
[More examples](https://github.com/mmagyar/yaschva/tree/master/examples)

Capabilities
=====================

Overview
--------

- Validate data based on a schema defined either in json or in type safe typescript.
- Returns easy to understand error messages on validation failure.
- Generate random data based on the schema.
- Generate typescript types from schema.

Strict and safe by default
--------------------------

Every field is mandatory by default,
and additional properties are rejected.

Concise definition
-----------------

The schema syntax is concise, and simple,
with as little noise as possible.

DRY schema
----------

Custom types can be defined and reused.
This enables recursive data structures and
makes sure that copy paste is not needed
to fully define the structure.

Helpful failure
---------------

When a validation fails,
it's output describes what went wrong
with the validation, in a way that reflects the original schema,
for easy troubleshooting.

Written in Typescript
---------------------

It helps auto complete while using it in the IDE.
The schema structure is also described in Typescript types.

100% unit test coverage
-----------------------

All code paths are tested,
every scenario is covered

Concise, easy to read implementation
------------------------------------

The whole validation is done in 310 lines of code.
That includes all the Typescript types.

Includes helpful tools
----------------------

It contains a random data generator,
that can generate random data,
It is useful for testing and mock APIs.

It can generate Typescript types from the schema,
so after validation you can be sure to have the
correct type, and Typescript can help you from there on.
This saves the effort of manually typing out the type and
precludes the possibility of making an error.

There is also a [playground](https://playground.yaschva.com)
where you can test out your schemas,
validate data or
generate dummy data.

Can self describe the schema
----------------------------

Yaschva is flexible enough to describe itself.

Schemas can be checked for errors that way, and
This enables the generator to generate
valid schema definitions.


Limitations
-----------

Property names starting with a $ (dollar sign) are reserved.
If your data structure has value names starting with $,
they need to be escaped in the schema: `{ "\\$escapedDollarSign": "string" }`


Project structure
-----------------

This project is written in typescript. These can be found under `./src`.

The default build will create ES6 Modules with EsNext target,
these can be found under package root directly in the npm package.

Sources compiled with Commonjs modules and es6 target can be found under `./cjs` in the npm package.

### Why not just use JSON schema?

JSON schema is a very sharp tool, which tons of features.
This project is in fact using a json schema to describe it's format, and provide validation and auto completion.

JSON schema syntax can be very noisy and hard to understand,
it provides dangerous defaults (everything is optional, including types, and additional properties are always accepted).

This project tries to simplify syntax for better readability, and provide more secure defaults among others.

JSON schema is very verbose,
yaschva's schema is defined with both itself and in JSON schema.
The JSON schema is about twice as long.

### How to use JSON schema definition when writing yaschva schema

In your yaschva schema file you need to add a property in the root object called:

`"$schema": "https://yaschva.com/schema.json"`

This will enable your IDE to help with yaschva's syntax and check for errors.

Note: the `$schema` property is not part of yaschva schema, and will be removed when using the `loadJson` function.


What can be improved
====================

Schema can not validate if the custom types are correct without actually running the validation
-----------------------------------------------------------------------------------------------

Right now, there is no way to define
that a string must exist as a key of another object.

Generating recursive Typescript type
------------------------------------

This is not currently possible,
because the type generator is designed to generate a single type,
unnamed type, but to do it for recursive types,
it must be named to enable recursion.
The type generation needs to be reworked a bit for it to work.

Arrays and maps with size constraint are not encoded in Typescript.

More constraints
----------------

There are a few more constraints
that are currently not supports but would be helpful
to implement, like:
- Array to be unique set
- Map to be a unique set
- Tuple type
- Require that a string is used as a key somewhere (maybe)

Literal Types
-------------

yeah, that

Faster happy path validation
----------------------------

Although Yaschva is very fast,
it could be speed up for valid values.
Right now it always builds up an object,
that reflects the input data structure,
to mark the problems where they occur.

An alternate validator could forgo this,
and just throw an error on the first failure.
After that it could send it to the error
collection implementation, to generate
a meaningful error message.
This creates a tradeoff, the best case speed is improved,
but the worst case speed is slower.

Better error output for complex, recursive schemas
--------------------------------------------------

The current error reporting is based on the validation
structure, not the input data.

This works fairly well for simpler data structures,
but anything more complicated, like the schema
describing itself, will return a hard to understand,
and verbose error report.

This happens, because if any error happens down the line,
the root will be marked invalid.

One solution should be to return an error report,
based on the input data, thus changing the error's
direction from top to bottom first.

Validate more then the root and first child properties at schema level in keyOf
-------------------------------------------------------------------------------

Right now, the implementation only has limited capability at self checking.
To solve this, keyOf may need to evolve into a `propertyPath`
or something similar

Decisions, Decisions, Decisions for the future
==============================================
