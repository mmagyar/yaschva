[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
![Node.js CI](https://github.com/mmagyar/yaschva/workflows/Node.js%20CI/badge.svg?branch=master)
![Code coverage](https://img.shields.io/codecov/c/github/mmagyar/yaschva)

#### A simple validation library, aimed at defining schema for api calls.
#### Using a concise definition, with safe defaults.

## Playground
There is an interactive playground, where yaschva can be test driven

[playground.yaschva.com](https://playground.yaschva.com)

## Examples
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

## Capabilities

- Validate data based on a schema defined either in json or in type safe typescript.
- Give easy to understand error messages.
- Generate random data based on the schema.
- Generate typescript types from schema.
- Declare your own types, to keep the schema DRY.

## Limitations

Property names starting with a $ (dollar sign) are reserved.
If your data structure has value names starting with $,
they need to be escaped in the schema: `{ "\\$escapedDollarSign": "string" }`


## Project structure
This project is written in typescript. These can be found under `./src`.

The default build will create ES6 Modules with EsNext target,
these can be found under package root directly in the npm package.

Sources compiled with Commonjs modules and es6 target can be found under `./cjs` in the npm package.

### Why not just use JSON schema?

JSON schema is a very sharp tool, which tons of features.
This project is in fact using a json schema to describe it's format, and provide validation and auto completion.

JSON schema syntax can be very noisy and hard to understand,
it provides dangerous defaults (everything is optional and additional properties are always accepted).

This project tries to simplify syntax for better readability, and provide more secure defaults among others.

### How to use JSON schema definition when writing yaschva schema

In your yaschva schema file you need to add a property in the root object called:

`"$schema": "https://yaschva.com/schema.json"`

This will enable your IDE to help with yaschva's syntax and check for errors.

Note: the `$schema` property is not part of yaschva schema, and will be removed when using the `loadJson` function.

### TODO
- Add "unique set" restriction to array
- Add options to generate a recursive type (Will require some redesign on how the types are generated)
