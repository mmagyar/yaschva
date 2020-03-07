
# yaschva

Yet another schema validation

## Why not just use JSON schama?

JSON schema is a very sharp tool, which tons of features. 
This project is in fact using a json schema to describe it's format, and provide validation and auto completion.

JSON schema's syntax can be very noisy and hard to understand, it provides dangerous defaults (everything is optional and additional properties are always accepted).

This project tries to simplify syntax for better redebility, and provide more secure defaults.

## How to use JSON schema definition when writing yaschva schema

[Download the schema here](typeSchema.json)
In your yaschava schema file you need to add the following:
