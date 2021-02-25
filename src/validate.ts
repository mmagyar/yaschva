import {
  Validation, StringType, ArrayType, ObjectType, SimpleTypes,
  isSimpleType, isArray, isEnum, isObj,
  isMap, isNumber, isMeta, isString, ValueType, isTypeDefValidation, ValueTypes, isAnd, AndType, MapType, NumberType, isKeyOf, isLiteral, KeyOfType, isTuple
} from './validationTypes.js'

interface Custom {custom: {[key: string]: ValueTypes}, root: any, type?: Validation}
type InputTypes = any | string | number | object | undefined | boolean | null
export type ValidationOutputs= ValidationOutput|ValidationOutput[]
export type ValidationOutput =
  | {[key: string]: ValidationOutputs}
  | null
  | {'error': string, output?: ValidationOutputs, value: any}

export interface ValidationResult {
  'result': 'pass'|'fail'
  output: ValidationOutputs
}
export interface ValidationFailed { message: string }
type SimpleValidation = string | null

const failValidation = (error: string, value: any, output?: ValidationOutputs): ValidationResult => {
  const content: ValidationOutputs = { error, value }
  return {
    result: 'fail',
    output: output ? { ...content, output } : content
  }
}

export const combineValidationObjects = <T>(type: AndType, customTypes: Custom, onError: (input: any) => T): {result: 'error', error: T} | {pass: ObjectType, result? : undefined} => {
  const resolveMeta = (tpe: Validation): Validation => {
    if (typeof tpe === 'string') { return resolveMeta(customTypes.custom[tpe]) }
    if (isMeta(tpe)) return resolveMeta(tpe.$type)
    return tpe
  }
  const resolvedType = type.$and.map(x => resolveMeta(x))

  if (resolvedType.some(x => !isObj(x))) {
    return { error: onError(resolvedType), result: 'error' }
  }

  return {
    pass: resolvedType.reduce((prev: any, current: any) => {
      return { ...prev, ...current }
    }, {})
  }
}

const validateUndefined = (value: InputTypes): SimpleValidation =>
  !(value === undefined) ? 'Value is not undefined' : null

const validateNull = (value: InputTypes): SimpleValidation =>
  !(value === null) ? 'Value is not null' : null

const validateNumber = (value: InputTypes): SimpleValidation =>
  !Number.isFinite(value) || typeof value !== 'number' ? 'Value is not a number' : null

const validateNumberComplex = (value: InputTypes, validation: NumberType): SimpleValidation => {
  const { min, max, integer } = validation.$number
  const res = integer ? validateInteger(value) : validateNumber(value)
  if (!res) {
    if (min !== undefined && value < min) return 'Value is smaller than the required minimum'
    if (max !== undefined && value > max) return 'Value is bigger than the required maximum'
  }
  return res
}
const validateInteger = (value: InputTypes): SimpleValidation =>
  !Number.isSafeInteger(value) ? 'Value is not an integer ' : null

const validateString = (value: InputTypes, enums?: string[]): SimpleValidation => {
  if (typeof value !== 'string') return 'Value is not a string'
  else if (enums?.length && !enums.some(x => value === x)) { return `Value needs to be one of the following: [${enums.join(', ')}] ` }
  return null
}

const validateStringObject = (value: InputTypes, validator: StringType): SimpleValidation => {
  if (typeof value !== 'string') return 'Value is not a string'
  if (validator.$string.minLength && value.length < validator.$string.minLength) { return 'String is shorter than the required minimum length' }
  if (validator.$string.maxLength && value.length > validator.$string.maxLength) { return 'String is longer than the required maximum length' }
  if (validator.$string.regex) {
    const regex = new RegExp(validator.$string.regex, 'u')
    if (!regex.test(value)) return 'String did not match required regex'
  }

  return null
}

const validateBool = (value: InputTypes): SimpleValidation =>
  typeof value !== 'boolean' ? 'Value is not a boolean' : null

const validateOneOf = (value: InputTypes, validator: ValueType[], customTypes: Custom):
ValidationResult => {
  if (!validator.length) throw new Error('Array of types can not be empty')

  const errors: ValidationOutput[] = []
  for (const i of validator) {
    const result = validateRecursive(i, value, customTypes)
    if (result.result === 'pass') return result
    if (Array.isArray(result.output)) result.output.forEach(x => errors.push(x))
    else errors.push(result.output)
  }

  return failValidation('Did not match any from the listed types', undefined, errors)
}

const validateArray = (value: InputTypes, validator: ArrayType, customTypes: Custom):
ValidationResult => {
  if (Array.isArray(value)) {
    const maxLength = validator.maxLength ?? Number.MAX_SAFE_INTEGER
    const minLength = validator.minLength ?? 0
    if (value.length < minLength || value.length > maxLength) {
      return failValidation(
        `Array length needs to be between ${minLength} - ${maxLength}`,
        value.length)
    }
    const resultArray: ValidationOutputs[] = []
    let fail = false
    for (const x of value) {
      const res = validateRecursive(validator.$array, x, customTypes)
      if (res.result === 'fail') fail = true
      resultArray.push(res.output)
    }
    return { result: fail ? 'fail' : 'pass', output: resultArray.flat() }
  }
  return failValidation('Value is not an Array', value)
}

const validateObject = (value: InputTypes, validator: ObjectType, customTypes: Custom):
ValidationResult => {
  if (typeof value !== 'object' ||
    value === null ||
    value === undefined ||
    Array.isArray(value)
  ) {
    return failValidation('Value is not an Object', value)
  }

  let fail = false
  const output: {[key: string]: ValidationOutputs} = {}

  for (const key of Object.keys(value)) {
    const validatorKey = key.startsWith('$') ? `\\${key}` : key
    if (!Object.prototype.hasOwnProperty.call(validator, validatorKey)) {
      fail = true
      output[key] = { error: 'Key does not exist on validator', value: value[key] }
    } else {
      const { result, output: outputInternal } = validateRecursive(validator[validatorKey], value[key], customTypes)
      if (result === 'fail') fail = true
      output[key] = outputInternal
    }
  }

  for (const validatorKey of Object.keys(validator)) {
    const key = validatorKey.startsWith('\\$') ? validatorKey.slice(1) : validatorKey
    if (!Object.prototype.hasOwnProperty.call(output, key)) {
      const { result, output: outputInternal } = validateRecursive(validator[validatorKey], value[key], customTypes)
      if (result === 'fail') fail = true
      output[key] = outputInternal
    }
  }

  return { result: fail ? 'fail' : 'pass', output }
}

const validateMap = (value: InputTypes, validator: MapType, customTypes: Custom):
ValidationResult => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return failValidation('Value is not a Map (freeform Object)', value)
  }
  let fail = false
  const output: {[key: string]: ValidationOutputs} = {}
  const keys = Object.keys(value)
  const keyCount = keys.length
  const maxLength = validator.maxLength ?? Number.MAX_SAFE_INTEGER
  const minLength = validator.minLength ?? 0
  if (keyCount < minLength || keyCount > maxLength) {
    return failValidation(
        `Map needs to have member count to be between ${minLength} - ${maxLength}`,
        keyCount)
  }
  let types: any = validator.keySpecificType

  if (types) {
    while (typeof types === 'string') {
      if (!types.startsWith('$')) throw new Error('Invalid keySpecificType: ' + types)
      types = customTypes.custom[types]
    }

    for (const key of Object.keys(types)) {
      const keyS = key.startsWith('\\$') ? key.slice(1) : key
      const { result, output: outputInternal } = validateRecursive(types[key], (value)[keyS], customTypes)
      if (result === 'fail') fail = true
      output[keyS] = outputInternal
    }
  }

  for (const key of keys) {
    if (typeof output[key] !== 'undefined') {
      continue
    }

    if (validator.key) {
      const result = validateRecursive(validator.key, key, customTypes)
      if (result.result === 'fail') {
        fail = true
        output[key] = result.output
        continue
      }
    }

    const { result, output: outputInternal } = validateRecursive(validator.$map, (value)[key], customTypes)
    if (result === 'fail') fail = true
    output[key] = outputInternal
  }

  return { result: fail ? 'fail' : 'pass', output }
}

const validateKeyOf = (value: InputTypes, type: KeyOfType, allTypes: Custom):
ValidationResult => {
  const current = type.$keyOf.reduce((p, c) => p?.[c], allTypes.root)
  const values = Object.keys(current || {})

  if (values.length === 0) {
    if (type.$keyOf.length) {
      const route = type.$keyOf.reduce((p: {current: any, root?: any}, c) => {
        p.current[c] = {}
        return { current: p.current[c], root: p.root || p.current }
      }, { current: {}, root: undefined })
      return toResult(`There where no keys under ${JSON.stringify(route, null, 2)}}`, value)
    }
    return toResult('Root does not have any keys', value)
  }

  const validated = validateString(value, values)
  if (validated) return toResult(validated, value)

  if (type.valueType && current) {
    const result = validateRecursive(type.valueType, current[value], allTypes)
    if (result.result === 'fail') { return toResult(`Key ${String(value)} did not have the required type`, value) }
  }

  return toResult(validated, value)
}

const validateAnd = (value: InputTypes, validator: AndType, customTypes: Custom):
ValidationResult => {
  const onError = (resolvedType: any): ValidationResult =>
    failValidation('SCHEMA error: $and must only contain objects', resolvedType)

  const combined = combineValidationObjects(validator, customTypes, onError)
  if (combined.result === 'error') return combined.error

  return validateObject(value, combined.pass, customTypes)
}
const simpleValidation = (type: SimpleTypes, value: any): SimpleValidation => {
  switch (type) {
    case 'any': return null
    case '?': return validateUndefined(value)
    case 'number': return validateNumber(value)
    case 'integer': return validateInteger(value)
    case 'string': return validateString(value)
    case 'boolean': return validateBool(value)
    case 'null': return validateNull(value)
    default: throw new Error(`Unknown validator:${JSON.stringify(type)}`)
  }
}

const toResult = (res: SimpleValidation, value: InputTypes): ValidationResult =>
  ({ result: res ? 'fail' : 'pass', output: res ? { error: res, value } : null })

const validateRecursive = (
  typeIn: Validation,
  value: InputTypes,
  fullValidationStructure: Custom): ValidationResult => {
  if (typeof typeIn === 'undefined') throw new Error('Type for validation cannot be undefined')

  let type: ValueTypes = typeIn
  const allTypes: Custom = fullValidationStructure
  if (isTypeDefValidation(typeIn)) {
    allTypes.custom = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  while (isSimpleType(type) && Boolean(allTypes.custom[type])) {
    type = allTypes.custom[type]
  }

  if (isSimpleType(type)) { return toResult(simpleValidation(type, value), value) }

  if (Array.isArray(type)) { return validateOneOf(value, type, allTypes) }

  if (isArray(type)) { return validateArray(value, type, allTypes) }

  if (isEnum(type)) { return toResult(validateString(value, type.$enum), value) }

  if (isKeyOf(type)) { return validateKeyOf(value, type, allTypes) }

  if (isMap(type)) { return validateMap(value, type, allTypes) }

  if (isNumber(type)) { return toResult(validateNumberComplex(value, type), value) }

  if (isMeta(type)) { return validateRecursive(type.$type, value, allTypes) }

  if (isString(type)) { return toResult(validateStringObject(value, type), value) }

  if (isAnd(type)) { return validateAnd(value, type, allTypes) }

  if (isLiteral(type)) {
    return toResult(value === type.$literal ? '' : `Value did not match literal: ${String(type.$literal)}`, value)
  }

  if (isTuple(type)) {
    if (!Array.isArray(value)) {
      return toResult('Value must be an array for tuple type', value)
    }

    if (value.length > type.$tuple.length) {
      return toResult('Array larger then tuple', value)
    }
    const results = type.$tuple.map((validation, index) => validateRecursive(validation, value[index], allTypes))
    const failed = results.some(x => x.result === 'fail')
    const output: ValidationOutputs = results.reduce((p: {[key: number]: ValidationOutputs}, c, i) => {
      p[i] = c.output
      return p
    }, {})

    return {
      result: failed ? 'fail' : 'pass',
      output: {
        error: 'Some values did not match expected types',
        output,
        value: value as any
      }
    }
  }

  if (isObj(type)) { return validateObject(value, type, allTypes) }

  throw new Error(`Unknown validator:${JSON.stringify(type)}`)
}

export const validate = (type: Validation, value: InputTypes): ValidationResult => {
  return validateRecursive(type, value, { root: value, custom: {}, type })
}

export const loadJson = (json: string | object): Validation => {
  const jsonOut: any = typeof json === 'string' ? JSON.parse(json) : json
  delete jsonOut.$schema

  return jsonOut
}
