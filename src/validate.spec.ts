import { ObjectValue, validate } from "./validate";

describe("validate", () => {
  it("passes validation for correct simple values", () => {
    expect(validate("string", "hello")).toHaveProperty("result", "pass");
    expect(validate("integer", 123)).toHaveProperty("result", "pass");
    expect(validate("number", 123.3)).toHaveProperty("result", "pass");
    expect(validate("boolean", true)).toHaveProperty("result", "pass");
    expect(validate("?", undefined)).toHaveProperty("result", "pass");
    expect(validate("any", 233)).toHaveProperty("result", "pass");
  });


  it("fails validation for incorrect simple values", () => {
    expect(validate("string", 234)).toHaveProperty("result", "fail");
    expect(validate("integer", 123.4)).toHaveProperty("result", "fail");
    expect(validate("integer", "123")).toHaveProperty("result", "fail");
    expect(validate("number", "123.4")).toHaveProperty("result", "fail");
    expect(validate("boolean", "true")).toHaveProperty("result", "fail");
    expect(validate("?", "yes")).toHaveProperty("result", "fail");
    //Fails for non safe integer above 2^53
    expect(validate("integer", 12332323423445323)).toHaveProperty("result", "fail");

    // any does not fail for any data type
  });

  it("passes objects with correct values", () => {
    expect(validate({}, {})).toHaveProperty("result", "pass");
    expect(validate({ myNumber: "number" }, { myNumber: 12.3 })).toHaveProperty("result", "pass");
    expect(validate(
      { num: "number", int: "integer", str: "string", bool: "boolean" },
      { num: 12.3, int: 12, str: "Hello", bool: false }
    )).toHaveProperty("result", "pass");
  });

  it("fails objects with missing properties", () => {
    expect(validate({ myNumber: "number" }, { })).toHaveProperty("result", "fail");
    expect(validate({ num: "number", int: "integer", str: "string", bool: "boolean" },
      { num: 3 })).toHaveProperty("result", "fail");

  });

  it("fails objects with incorrect values", () => {
    expect(validate({}, null)).toHaveProperty("result", "fail");
    expect(validate({ num: "number", int: "integer", str: "string", bool: "boolean" },
      JSON.stringify({ num: 12.3, int: 12, str: "Hello", bool: false })))
      .toHaveProperty("result", "fail");
  });

  it("can handle multiple type for a single value", () => {
    expect(validate(["integer", "string"], "hello")).toHaveProperty("result", "pass");
    expect(validate(["integer", "string"], 123)).toHaveProperty("result", "pass");
    expect(validate(["integer", "string"], {})).toHaveProperty("result", "fail");

  });

  it("handles optional values via multi-types", () => {
    expect(validate(["integer", "string", "?"], "hello")).toHaveProperty("result", "pass");
    expect(validate(["integer", "string", "?"], 123)).toHaveProperty("result", "pass");
    expect(validate(["integer", "string", "?"], undefined)).toHaveProperty("result", "pass");
    expect(validate(["integer", "string", "?"], {})).toHaveProperty("result", "fail");

    const type: ObjectValue = { myValue: ["integer", "string", "?"] };
    expect(validate(type, { myValue: 1233232342344532 })).toHaveProperty("result", "pass");
    expect(validate(type, { myValue: "abc" })).toHaveProperty("result", "pass");
    expect(validate(type, { })).toHaveProperty("result", "pass");
    expect(validate(type, undefined)).toHaveProperty("result", "fail");
  });

  it("handles arrays with special syntax", () => {
    expect(validate({ $array: "string" }, ["hello"])).toHaveProperty("result", "pass");
    expect(validate({ $array: "string" }, ["hello", "abc"])).toHaveProperty("result", "pass");
    expect(validate({ $array: "string" }, [2])).toHaveProperty("result", "fail");
    expect(validate({ $array: "string" }, "hello")).toHaveProperty("result", "fail");
    expect(validate(["integer", { $array: ["string"] }], ["true", "this"]))
      .toHaveProperty("result", "pass");
    expect(validate(["integer", { $array: ["string"] }], [1])).toHaveProperty("result", "fail");
  });


  it("handles enums with special syntax", () => {
    const type: ObjectValue = { $enum: ["ts", "typescript"] };
    expect(validate(type, "ts")).toHaveProperty("result", "pass");
    expect(validate(type, "typescript")).toHaveProperty("result", "pass");
    expect(validate(type, "javascript")).toHaveProperty("result", "fail");
    expect(validate(type, ["ts"])).toHaveProperty("result", "fail");
    expect(validate(type, { $enum: "ts" })).toHaveProperty("result", "fail");
  });

  it("provides useful error description", () => {
    const type: ObjectValue = { num: "number", int: "integer", str: "string", bool: "boolean",
      obj: { member: "boolean", memberId: ["string", "?"] } };
    const result = validate(type, { num: "abc" });

    expect(result).toHaveProperty("result", "fail");
    expect(result.output).toStrictEqual({
      num: { error: "Value is not a number", value: "abc" },
      int: { error: "Value is not an integer ", value: undefined },
      str: { error: "Value is not a string", value: undefined },
      bool: { error: "Value is not a boolean", value: undefined },
      obj: { error: "Value is not an Object", value: undefined }
    });

    const result2 = validate(type, { int: 123.3, str: [], bool: "true", obj: {} });

    expect(result2).toHaveProperty("result", "fail");
    expect(result2.output).toStrictEqual({
      num: { error: "Value is not a number", value: undefined },
      int: { error: "Value is not an integer ", value: 123.3 },
      str: { error: "Value is not a string", value: [] },
      bool: { error: "Value is not a boolean", value: "true" },
      obj: { member: { error: "Value is not a boolean", value: undefined },
        memberId: null }
    });
  });

  it("uses null to signal that there is no error for a given property", () => {
    const type: ObjectValue =
    { obj: { member: "boolean", memberId: ["string", "?"], nested: { inside: "string" } } };
    const result = validate(type, { obj: { member: false, nested: { inside: "hello" } } });

    expect(result).toHaveProperty("result", "pass");
    expect(result.output).toStrictEqual({ obj: { member: null,
      nested: { inside: null },
      memberId: null } });
  });

  it("rejects objects with additional keys", () => {
    expect(validate({ myValue: "integer" }, { myValue: 2, ourValue: 3 }))
      .toHaveProperty("result", "fail");
  });

  it("throws on type definition with empty array of types", () => {
    expect(() => validate({ myValue: [] }, { myValue: 2 })).toThrowError();
  });

  it("throws on unknown type definition", () => {
    expect(() => validate({ myValue: "bigFlout" } as any, { myValue: 2 }))
      .toThrowError("Unknown validator:\"bigFlout\"");

    expect(() => validate({ $whatever: "bigFloat" } as any, { myValue: 2 }))
      .toThrowError("Unknown validator:{\"$whatever\":\"bigFloat\"}");

    expect(() => validate(undefined as any, { }))
      .toThrowError("Type for validation cannot be undefined");
  });

  it("reserves keys starting with $ (dollar sign) for type data", () => {
    expect(() => validate({ $whatever: "string" }, { $whatever: 2 })).toThrowError();
  });

});
