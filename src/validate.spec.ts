/* eslint-disable dot-notation */
import test, { ExecutionContext } from "ava"

import { validate, loadJson } from "./validate.js"
import { Validation } from "./validationTypes.js"
import fs from "fs"
import path from "path"
import { inspect } from "util"
inspect.defaultOptions.depth = null

const file = fs.promises.readFile
let loaded:Validation
const schemaSchema = () => {
  if (!loaded) { loaded = loadJson(fs.readFileSync("./selfSchema.json", "utf8")) }
  return loaded
}
test.afterEach(() => {
  // eslint-disable-next-line no-proto
  delete ({} as any).__proto__.b
})
const validSchema = (schema:Validation, t:ExecutionContext):Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, "pass", JSON.stringify(validated, null, 2) +
        "\n\nInvalid Schema\n\n")

  return schema
}

const invalidSchema = (schema:any, t:ExecutionContext):Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, "fail", JSON.stringify(validated, null, 2) +
        "\n\nValid Schema, expected invalid\n\n")
  return schema
}

const valid = (schema:Validation, data:any, t:ExecutionContext) => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, "pass", JSON.stringify(dataValid, null, 2) +
      "\n\nData validation failed, but it should have passed\n")
}

const invalid = (schema:Validation, data:any, t:ExecutionContext) => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, "fail", JSON.stringify(dataValid, null, 2) +
      "\n\nData validation passed, but it should have failed\n")
}
const loadAndAddTestsBasedOnJsonDefinitions = () => {
  const testJsonFolder = "./src/tests"
  const dirs = fs.readdirSync(testJsonFolder)

  dirs.forEach(x => {
    if (x.endsWith("json")) {
      const file = fs.readFileSync(path.join(testJsonFolder, x), "utf-8")
      const json = JSON.parse(file)
      json.forEach((element:any, i:number) => {
        const indexName = element.name ? ` ${element.name}` : json.length > 1 ? ` > ${i}` : ""

        if (element.invalidSchema) {
          const invalidData = element.invalidData || []
          if (!invalidData.length) {
            test(`${x}${indexName} > invalid schema`, t => {
              invalidSchema(element.invalidSchema, t)
            })
          } else {
            invalidData.forEach((z:any, j:number) => {
              test(`${x}${indexName} > invalid data > ${j}`, t => {
                const schema = invalidSchema(element.invalidSchema, t)
                if (element.throws) {
                  const error = t.throws(() => validate(schema, z))
                  if (typeof element.throws === "string") {
                    t.is(error.message, typeof element.throws === "string" ? element.throws : undefined)
                  }
                } else {
                  t.is(validate(schema, z).result, "fail")
                }
              })
            })
          }
        }

        if (element.schema) {
          const validData = element.validData || []
          const invalidData = element.invalidData || []
          validData.forEach((z:any, j:number) => {
            test(`${x}${indexName} > valid data > ${j}`, (t) => valid(element.schema, z, t))
          })

          invalidData.forEach((z:any, j:number) => {
            test(`${x}${indexName} > invalid data > ${j}`, (t) => invalid(element.schema, z, t))
          })
        }
      })
    }
  })
}

loadAndAddTestsBasedOnJsonDefinitions()

test("Shows example schema working", async (t) => {
  const example = loadJson(await file("./examples/example1.json", "utf8"))
  validSchema(example, t)
  const data = {
    "myString": "35p5Rx",
    "myOptionalString": "opts",
    "myObject": {
      "myNumberInsideAnObject": -1064355751952420,
      "myDetailedNumberInsideAnObject": 7.547970286391079
    },
    "myArrayOfNumbers": [6021837145779515, -3586724423310628, 7654360694223995, -4591855572376372],
    "myEnum": "enum2",
    "myNumberRange": 5,
    "myKeyValuePairs": {
      "h5mRyKCL": "fq3aXU", "wff99z2e": "4D0Ptj", "h3VcecUx": "vmKmRU", "Ox3CN4Iq": "2FWzGw"
    },
    "myMultiType": -8508087912141643,
    "myNull": null,
    "myRegex": "work",
    "myAddress": {
      "name": "Homer Simpson",
      "street": "742 Evergreen Terrace",
      "city": "Springfield",
      "country": "USA"
    }
  }
  t.is(validate(example, data)["result"], "pass")
  t.is(validate(example, { })["result"], "fail")

  t.deepEqual(validate(example, { }), {
    "result": "fail",
    "output": {
      "myString": { "error": "Value is not a string", "value": undefined },
      "myOptionalString": null,
      "myObject": { "error": "Value is not an Object", "value": undefined },
      "myArrayOfNumbers": { "error": "Value is not an Array", "value": undefined },
      "myEnum": { "error": "Value is not a string", "value": undefined },
      "myKeyValuePairs": { "error": "Value is not a Map (freeform Object)", "value": undefined },
      "myMultiType": {
        "error": "Did not match any from the listed types",
        "value": undefined,
        "output": [
          { "error": "Value is not a string", "value": undefined },
          { "error": "Value is not a number", "value": undefined }
        ]
      },
      "myNull": { "error": "Value is not null", "value": undefined },
      "myNumberRange": { "error": "Value is not a number", "value": undefined },
      "myRegex": { "error": "Value is not a string", "value": undefined },
      "myAddress": { "error": "Value is not an Object", "value": undefined }
    }
  })
})

test("Can validate itself with itself", async (t) => {
  const example = loadJson(await file("./selfSchema.json", "utf8"))
  const validated = validate(example, example)
  fs.writeFileSync("../test_out.json", JSON.stringify(validated, null, 2))
  t.is(validated["result"], "pass")
})

test("Provides useful error description", (t) => {
  const type = validSchema({
    "num": "number",
    "int": "integer",
    "str": "string",
    "bool": "boolean",
    "obj": { "member": "boolean", "memberId": ["string", "?"] }
  }, t)
  const result = validate(type, { "num": "abc" })

  t.is(result["result"], "fail")

  t.deepEqual(result.output, {
    "num": { "error": "Value is not a number", "value": "abc" },
    "int": { "error": "Value is not an integer ", "value": undefined },
    "str": { "error": "Value is not a string", "value": undefined },
    "bool": { "error": "Value is not a boolean", "value": undefined },
    "obj": { "error": "Value is not an Object", "value": undefined }
  })

  const result2 = validate(type, { "int": 123.3, "str": [], "bool": "true", "obj": {} })

  t.is(result2["result"], "fail")
  t.deepEqual(result2.output, {
    "num": { "error": "Value is not a number", "value": undefined },
    "int": { "error": "Value is not an integer ", "value": 123.3 },
    "str": { "error": "Value is not a string", "value": [] },
    "bool": { "error": "Value is not a boolean", "value": "true" },
    "obj": {
      "member": { "error": "Value is not a boolean", "value": undefined },
      "memberId": null
    }
  })
})

test("Uses null to signal that there is no error for a given property", (t) => {
  const type = validSchema({
    "obj": { "member": "boolean", "memberId": ["string", "?"], "nested": { "inside": "string" } }
  }, t)
  const result = validate(type, { "obj": { "member": false, "nested": { "inside": "hello" } } })

  t.is(result["result"], "pass")
  t.deepEqual(result.output, {
    "obj": {
      "member": null,
      "nested": { "inside": null },
      "memberId": null
    }
  })
})

test("Throws on undefined", (t) => {
  t.throws(() => validate(invalidSchema(undefined, t), {}), null
    , "Type for validation cannot be undefined")
})

test("Reserves keys starting with $ (dollar sign) for type data", (t) => {
  t.throws(() => validate(invalidSchema({ "$whatever": "string" }, t), { "$whatever": 2 }))
})

test("Can validate string length", (t) => {
  const schema = validSchema({ "$string": { "minLength": 4, "maxLength": 6 } }, t)
  t.deepEqual(validate(schema, "abc"), {
    "result": "fail",
    "output": {
      "error": "String is shorter than the required minimum length", "value": "abc"
    }
  })

  t.deepEqual(validate(schema, "Lorem ipsum"), {
    "result": "fail",
    "output": {
      "error": "String is longer than the required maximum length", "value": "Lorem ipsum"
    }
  })

  valid(schema, "hello", t)
})

test("Can validate string by regex", (t) => {
  const schema = validSchema({ "$string": { "regex": "hello \\w+" } }, t)
  t.deepEqual(validate(schema, "abc"), {
    "result": "fail",
    "output": {
      "error": "String did not match required regex", "value": "abc"
    }
  })

  valid(schema, "hello world", t)
})

test("Can enforce maximum / minimum number", (t) => {
  const schema = validSchema({ "$number": { "min": 1, "max": 66 } }, t)

  t.deepEqual(validate(schema, 0), {
    "result": "fail",
    "output": { "error": "Value is smaller than the required minimum", "value": 0 }
  })

  t.deepEqual(validate(schema, 67), {
    "result": "fail",
    "output": { "error": "Value is bigger than the required maximum", "value": 67 }
  })

  t.is(validate(schema, 44.5)["result"], "pass")
})

test("Can enforce maximum / minimum number as integers", (t) => {
  const schema = validSchema({ "$number": { "min": 1, "max": 66, "integer": true } }, t)

  t.is(validate(schema, 0)["result"], "fail")

  t.is(validate(schema, 67)["result"], "fail")

  t.is(validate(schema, 44.5)["result"], "fail")
  t.is(validate(schema, 44)["result"], "pass")
})

test("Can validate key value pairs (map)", (t) => {
  const schema: Validation = { "$map": ["number"] }
  valid(schema, { "x": 3, "y": 4, "z": 99 }, t)
  invalid(schema, { "x": 3, "y": 4, "z": "99" }, t)
  invalid(schema, { "x": 3, "y": "a string", "z": 34 }, t)
})

test("Key value pair keys can be regex validated", (t) => {
  const schema: Validation = { "$map": ["number"], "key": { "$string": { "regex": "^ab[a-z]" } } }
  valid(schema, { "abx": 3, "aby": 4, "abz": 99 }, t)
  invalid(schema, { "x": 3, "y": 4, "z": 99 }, t)
  invalid(schema, { "abx": 3, "aby": "a string", "abz": 34 }, t)
})

// test('Protects against global object prototype injection', (t) => {
//   const schema = validSchema({ a: 'number', b: ['string', '?'] }, t)
//   const input: any = { a: 4 }
//   // eslint-disable-next-line no-proto
//   input.__proto__.b = 99
//   const result:any = validate(schema, input)
//   t.is(result['output']?.a, null)
//   t.is(result.output.b.error, 'Did not match any from the listed types')
// })

test("Protects against prototype injection on class", (t) => {
  const schema = validSchema({ "a": "number", "b": ["string", "?"] }, t)
  // eslint-disable-next-line no-useless-constructor
  class Test1 { constructor (public readonly a: number) {} }
  const input: any = new Test1(4)
  // eslint-disable-next-line no-proto
  input.__proto__.b = 3
  const result:any = validate(schema, input)
  t.is(result["output"]?.a, null)
  t.is(result.output.b.error, "Did not match any from the listed types")
})

test("Protects against prototype injection from json", (t) => {
  const schema = validSchema({ "a": "number", "b": "number" }, t)
  const input: any = JSON.parse("{ \"a\": 5, \"__proto__\": {\"b\" : \"some other\"} }")
  const input2 = { ...input }
  const result :any = validate(schema, input2)

  t.is(result["output"]?.a, null)
  t.is(result.output.b.error, "Value is not a number")
})

test("Can use type definitions", (t) => {
  const schema = validSchema({
    "$types": { "$range": { "$number": { "min": 1, "max": 99 } } },
    "a": "number",
    "b": "$range"
  }, t)

  valid(schema, { "a": 2, "b": 43 }, t)
  invalid(schema, { "a": 2, "b": 101 }, t)
  invalid(schema, { "a": 2, "b": 0 }, t)
})

test("Type definitions can reference each other.", (t) => {
  const schema: Validation = {
    "$types": {
      "$myObject": { "itsRange": "$range", "name": "string" },
      "$range": { "$number": { "min": 1, "max": 99 } }
    },
    "a": "$myObject",
    "b": "$range"
  }

  valid(schema, { "a": { "name": "abc", "itsRange": 22 }, "b": 43 }, t)
  invalid(schema, { "a": { "name": "abc", "itsRange": 101 }, "b": 43 }, t)
  invalid(schema, { "a": { "name": "abc", "itsRange": 22 }, "b": 0 }, t)
  invalid(schema, { "a": 2, "b": 0 }, t)
})

test("$ sign can be escaped in the schema and used for data key", (t) => {
  const validated:any = validate(
    validSchema({ "myNumber": "number", "\\$escapedDollar": "string" }, t),
    { "myNumber": 12.3, "$escapedDollar": "value" })
  t.is(validated["result"], "pass")
  t.is(validated.output?.["$escapedDollar"], null)

  const validated2:any = validate(
    validSchema({ "myNumber": "number", "\\$escapedDollar": "string" }, t),
    { "myNumber": 12.3, "$escapedDollar": 234 })
  t.is(validated2["result"], "fail")
  t.deepEqual(validated2.output.$escapedDollar,
    { "error": "Value is not a string", "value": 234 })
})

test("Root can be a meta type", (t) => {
  valid({ "$type": { "$array": "string" } }, ["a", "b", "c"], t)
})

test("Root can be a custom type via a meta type", (t) => {
  const validated = validate({
    "$types": { "$customType": { "value": "string", "nodes": { "$array": "$customType" } } },
    "$type": "$customType"
  }, { "value": "abc", "nodes": [{ "value": "xyz", "nodes": [] }] })
  t.is(validated["result"], "pass")
})

test("Can validated recursive data structure", (t) => {
  const schema :Validation = {
    "$types": { "$tree": { "value": "string", "left": ["?", "$tree"], "right": ["?", "$tree"] } },
    "root": "$tree"
  }

  valid(schema, {
    "root": {
      "value": "Dcn819x2PCmJV",
      "left": {
        "value": "mEiX0hq435IXt",
        "left": { "value": "coGEB1xXQmsRS" },
        "right": { "value": "6lBoBa" }
      },
      "right": {
        "value": "mV9j2",
        "left": { "value": "iL42zyiOv" },
        "right": { "value": "Bx6FbX" }
      }
    }
  }, t)
})

test("Can validate to multiple objects with $and", (t) => {
  const schema:Validation = {
    "$and": [
      { "valueA": "string" },
      { "valueB": "number" },
      { "$type": { "otherValue": "number" } }]
  }
  valid(schema, { "valueA": "someString", "valueB": 32, "otherValue": 9 }, t)
})

test("Schema is invalid if $and refers to custom type that is not an object", (t) => {
  const schema:Validation = invalidSchema({
    "$types": {
      "$myCustom": "string"
    },
    "$and": [
      { "valueA": "string" }, "$myCustom"]
  }, t)
  t.is(validate(schema, { "valueA": "someString", "ohWell": "xpc" }).result, "fail")
})

test("When and $and is specified input must satisfy both objects", (t) => {
  invalid({ "$and": [{ "valueA": "string" }, { "valueB": "number" }] },
    { "valueA": "someString" }, t)
})

test("$and only accepts object", (t) => {
  const schema = invalidSchema({ "$and": [{ "valueA": "string" }, "string"] }, t)
  t.is(validate(schema, { "valueA": 2 })["result"], "fail")
})

test("Can validate to multiple custom types with $and", (t) => {
  const schema:Validation = {
    "$types": {
      "$myObject": { "value": "string" },
      "$otherObject": { "num": "number" },
      "$myMetaObject": { "$type": { "value2": "string" } }
    },
    "$and": [{ "valueA": "string" }, "$myObject", "$myMetaObject", { "$type": "$otherObject" }]
  }
  valid(schema, {
    "valueA": "someString",
    "value": "value",
    "value2": "value2",
    "num": 88
  }, t)
})

test("Will reject arrays that are too short", (t) => {
  invalid({ "$array": "string", "minLength": 3 }, ["abc", "efg"], t)
})

test("Will reject arrays that are too long", (t) => {
  invalid({ "$array": "string", "maxLength": 3 }, ["abc", "efg", "some", "value"], t)
})

test("Will accept arrays that has a length between the constraints", (t) => {
  valid({ "$array": "string", "minLength": 1, "maxLength": 3 }, ["some", "value"], t)
})
