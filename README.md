[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
![Node.js CI](https://github.com/mmagyar/yaschva/workflows/Node.js%20CI/badge.svg?branch=master)
![Code coverage](https://img.shields.io/codecov/c/github/mmagyar/yaschva)

A simple validation library, aimed at defining schema for api calls.

## Examples

[Examples](https://github.com/mmagyar/yaschva/tree/master/examples)

## Limitations

Property names starting with a $ (dollar sign) are reserved.

## Capabilities

- Validate data based on a schema defined either in json or in type safe typescript.
- Give easy to understand error messages.
- Generate random data based on the schema.
- Generate typescript types from schema.
- Declare your own types, to keep the schema DRY.

### Why not just use JSON schema?

JSON schema is a very sharp tool, which tons of features.
This project is in fact using a json schema to describe it's format, and provide validation and auto completion.

JSON schema syntax can be very noisy and hard to understand, it provides dangerous defaults (everything is optional and additional properties are always accepted).

This project tries to simplify syntax for better readability, and provide more secure defaults among others.

### How to use JSON schema definition when writing yaschva schema

In your yaschva schema file you need to add a property in the root object called:

`"$schema": "https://yaschva.com/schema.json"`

This will enable your IDE to help with yaschva's syntax and check for errors.

Note: the `$schema` property is not part of yaschva schema, and will be removed when using the `loadJson` function.
