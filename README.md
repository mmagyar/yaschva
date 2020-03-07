
## Examples

[Examples](examples)

## Limitations

Property names starting with a $ (dollar sign) are reserved
## Capabilities
- Validate based on the schema
- Give easy to understand error messages
- Generate random data based on the schema

## Why not just use JSON schema?

JSON schema is a very sharp tool, which tons of features.
This project is in fact using a json schema to describe it's format, and provide validation and auto completion.

JSON schemas syntax can be very noisy and hard to understand, it provides dangerous defaults (everything is optional and additional properties are always accepted).

This project tries to simplify syntax for better readability, and provide more secure defaults.

## How to use JSON schema definition when writing yaschva schema

In your yaschava schema file you need to add a property in the root object called:

`"$schema": "https://mmagyar.github.io/yaschva/typeSchema.json"`

This will enable your IDE to help with yaschva's syntax and check for errors
