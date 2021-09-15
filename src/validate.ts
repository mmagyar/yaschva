import {
  Validation, StringType, ArrayType, ObjectType, SimpleTypes,
  isSimpleType, isArray, isEnum, isObj,
  isMap, isNumber, isMeta, isString, ValueType, isTypeDefValidation, ValueTypes, isAnd, AndType, MapType, NumberType, isKeyOf, isLiteral, KeyOfType, isTuple, isPropertyPath, PropertyPathType
} from './validationTypes.js'

interface Custom { custom: { [key: string]: ValueTypes }, root: any }
type InputTypes = any | string | number | object | undefined | boolean | null
export type ValidationOutputs = ValidationOutput | ValidationOutput[]
export type ValidationOutput =
  | {error: 'objectResult', objectResults: { [key: string]: ValidationOutputs }, errorCount: number, depth: number}
  | null
  | { 'error': string, output?: ValidationOutputs, value: any, objectResults?: undefined, errorCount?: undefined, depth: number }

export interface ValidationResult {
  'result': 'pass' | 'fail'
  output: ValidationOutputs
}
export interface ValidationFailed { message: string }
type SimpleValidation = string | null

// Omit values from the output if they are potentially too verbose, right now it means that we are hiding objects
const omitValue = true

const omitDisplay = <T>(value: T): T|string =>
  omitValue ? (value && typeof value === 'object' ? '[object ommited]' : value) : value

const failValidation = (error: string, value: any, depth: number, output?: ValidationOutputs): ValidationResult => {
  const content: ValidationOutputs = { error, depth, value: omitDisplay(value) }
  return {
    result: 'fail',
    output: output ? { ...content, output } : content
  }
}

const depthSort = (a: ValidationOutput, b: ValidationOutput): number => {
  const x = (a?.depth ?? 0)

  const y = (b?.depth ?? 0)

  if (x === y) {
    if (typeof a?.errorCount === 'number') {
      if (typeof b?.errorCount === 'number') {
        // Object with less errors are more likely to be the correct validation
        return a.errorCount - b.errorCount
      }
      return -1
    } else if (b?.error === 'objectResult') {
      return 1
    }
  }

  return y - x
}

export const combineValidationObjects = <T>(type: AndType, customTypes: Custom, onError: (input: any) => T): { result: 'error', error: T } | { pass: ObjectType, result?: undefined } => {
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

export interface CustomProcessedValidation {
  validation: ValueTypes
  customTypes: { [key: string]: ValueTypes }
}

export const processCustomTypes = (typeIn: Validation): CustomProcessedValidation => {
  let customTypes: ValueTypes = {}
  let type: ValueTypes = typeIn
  if (isTypeDefValidation(typeIn)) {
    customTypes = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  return { validation: type, customTypes }
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

const validateOneOf = (value: InputTypes, validator: ValueType[], depth: number, customTypes: Custom):
ValidationResult => {
  if (!validator.length) throw new Error('Array of types can not be empty')

  const errors: ValidationOutput[] = []
  let maxDepth = depth
  for (const i of validator) {
    const result = validateRecursive(i, value, depth + 1, customTypes)
    if (result.result === 'pass') return result
    maxDepth = Math.max(maxDepth, getMaxDepth(result.output))
    if (Array.isArray(result.output)) result.output.forEach(x => errors.push(x))
    else errors.push(result.output)
  }

  return failValidation('Did not match any from the listed types', omitDisplay(value), maxDepth, errors.sort(depthSort)
  )
}

const getMaxDepth = (validationOutput: ValidationOutputs): number => {
  if (validationOutput === null) return 0
  if (Array.isArray(validationOutput)) {
    return validationOutput.map(x => getMaxDepth(x)).reduce((p, c) => Math.max(p, c), 0)
  }
  return validationOutput.depth
}

const validateArray = (value: InputTypes, validator: ArrayType, depth: number, customTypes: Custom):
ValidationResult => {
  if (Array.isArray(value)) {
    const maxLength = validator.maxLength ?? Number.MAX_SAFE_INTEGER
    const minLength = validator.minLength ?? 0
    if (value.length < minLength || value.length > maxLength) {
      return failValidation(
        `Array length needs to be between ${minLength} - ${maxLength}`,
        value.length, depth)
    }
    const resultArray: ValidationOutputs[] = []
    // let maxDepth = depth
    let fail = false
    for (const x of value) {
      const res = validateRecursive(validator.$array, x, depth + 1, customTypes)
      if (res.result === 'fail') fail = true

      // maxDepth = Math.max(maxDepth, getMaxDepth(res.output))
      resultArray.push(res.output)
    }

    return { result: fail ? 'fail' : 'pass', output: resultArray.flat().sort(depthSort) }
  }
  return failValidation('Value is not an Array', value, depth)
}

const validateObject = (value: InputTypes, validator: ObjectType, depth: number, customTypes: Custom):
ValidationResult => {
  if (typeof value !== 'object' ||
    value === null ||
    value === undefined ||
    Array.isArray(value)
  ) {
    return failValidation('Value is not an Object', value, depth)
  }

  let fail = false
  const output: { [key: string]: ValidationOutputs } = {}
  let maxDepth = depth
  let errorCount = 0
  for (const key of Object.keys(value)) {
    const validatorKey = key.startsWith('$') ? `\\${key}` : key
    if (!Object.prototype.hasOwnProperty.call(validator, validatorKey)) {
      fail = true
      errorCount++
      output[key] = { error: 'Key does not exist on validator', depth, value: omitDisplay(value[key]) }
    } else {
      const { result, output: outputInternal } = validateRecursive(validator[validatorKey], value[key], depth + 1, customTypes)
      if (result === 'fail') {
        fail = true
        errorCount++
      }
      maxDepth = Math.max(maxDepth, getMaxDepth(outputInternal))
      output[key] = outputInternal
    }
  }

  for (const validatorKey of Object.keys(validator)) {
    const key = validatorKey.startsWith('\\$') ? validatorKey.slice(1) : validatorKey
    if (!Object.prototype.hasOwnProperty.call(output, key)) {
      const { result, output: outputInternal } = validateRecursive(validator[validatorKey], value[key], depth + 1, customTypes)
      if (result === 'fail') {
        fail = true
        errorCount++
      }
      maxDepth = Math.max(maxDepth, getMaxDepth(outputInternal))
      output[key] = outputInternal
    }
  }

  return { result: fail ? 'fail' : 'pass', output: { error: 'objectResult', depth: maxDepth, errorCount, objectResults: output } }
}

const validateMap = (value: InputTypes, validator: MapType, depth: number, customTypes: Custom):
ValidationResult => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return failValidation('Value is not a Map (freeform Object)', value, depth)
  }
  let fail = false
  let maxDepth = depth
  let errorCount = 0
  const output: { [key: string]: ValidationOutputs } = {}
  const keys = Object.keys(value)
  const keyCount = keys.length
  const maxLength = validator.maxLength ?? Number.MAX_SAFE_INTEGER
  const minLength = validator.minLength ?? 0
  if (keyCount < minLength || keyCount > maxLength) {
    return failValidation(
      `Map needs to have member count to be between ${minLength} - ${maxLength}`,
      keyCount,
      depth)
  }
  let types: any = validator.keySpecificType

  if (types) {
    while (typeof types === 'string') {
      if (!types.startsWith('$')) throw new Error('Invalid keySpecificType: ' + types)
      types = customTypes.custom[types]
    }

    for (const key of Object.keys(types)) {
      const keyS = key.startsWith('\\$') ? key.slice(1) : key
      const { result, output: outputInternal } = validateRecursive(types[key], (value)[keyS], depth + 1, customTypes)
      if (result === 'fail') {
        fail = true
        errorCount++
      }
      maxDepth = Math.max(maxDepth, getMaxDepth(outputInternal))
      output[keyS] = outputInternal
    }
  }

  for (const key of keys) {
    if (typeof output[key] !== 'undefined') {
      continue
    }

    if (validator.key) {
      const result = validateRecursive(validator.key, key, depth + 1, customTypes)
      if (result.result === 'fail') {
        fail = true
        errorCount++
        maxDepth = Math.max(maxDepth, getMaxDepth(result.output))
        output[key] = result.output
        continue
      }
    }

    const { result, output: outputInternal } = validateRecursive(validator.$map, (value)[key], depth + 1, customTypes)
    if (result === 'fail') {
      fail = true
      errorCount++
    }
    maxDepth = Math.max(maxDepth, getMaxDepth(outputInternal))
    output[key] = outputInternal
  }

  return { result: fail ? 'fail' : 'pass', output: { error: 'objectResult', depth: maxDepth, errorCount, objectResults: output } }
}

const validateKeyOf = (value: InputTypes, type: KeyOfType, depth: number, allTypes: Custom):
ValidationResult => {
  const current = type.$keyOf.reduce((p, c) => p[c], allTypes.root)
  const values = Object.keys(current || {})

  if (values.length === 0) {
    if (type.$keyOf.length) {
      const route = type.$keyOf.reduce((p: { current: any, root?: any }, c) => {
        p.current[c] = {}
        return { current: p.current[c], root: p.root || p.current }
      }, { current: {}, root: undefined })
      return toResult(`There where no keys under ${JSON.stringify(route, null, 2)}}`, value, depth)
    }
    return toResult('Root does not have any keys', value, depth)
  }

  const validated = validateString(value, values)
  if (validated) return toResult(validated, value, depth)

  if (type.valueType && current) {
    const result = validateRecursive(type.valueType, current[value], depth, allTypes)
    if (result.result === 'fail') { return toResult(`Key ${String(value)} did not have the required type`, depth, value) }
  }

  return toResult(validated, value, depth)
}

const validatePropertyPath = (value: InputTypes, type: PropertyPathType, depth: number, allTypes: Custom): ValidationResult => {
  const dataValidation = validate({ $array: 'string' }, value)
  if (dataValidation.result === 'fail') return dataValidation
  let current = allTypes.root
  const valuesSoFar = []
  for (const key of value) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return toResult(`There is no key called ${key} on ${valuesSoFar.join(':')}`, value, depth)
    }

    current = current[key]
    valuesSoFar.push(key)
  }

  if (type.$propertyPath.onlyObjects) {
    // Resolve custom type
    while (isSimpleType(current) && allTypes.root?.$types?.[current]) {
      current = allTypes.root?.$types?.[current]
    }

    if (isMeta(current)) {
      current = current.$type
    }

    // This may not be a good idea after all, since it does not guarantuee soundness
    // Just because it points to a map, it still can be invalid, if the map has no members
    // Just beucase it points to something that is optionally not defined, it may still be valid, since this validation may be optional as well
    // Oh well, it may still be used for validation though
    const withoutKeys = (x: any): boolean => isSimpleType(x) || isString(x) || isNumber(x) ||
      isEnum(x) || isAnd(x) || isKeyOf(x) || isLiteral(x) || isTuple(x) || isPropertyPath(x) || false
    let withoutKeysResult = false

    if (Array.isArray(current)) {
      withoutKeysResult = !current.some(x => !withoutKeys(x))
    } else withoutKeysResult = withoutKeys(current)

    if (withoutKeysResult) return toResult('The value under final key did not have the desired type', value, depth)
    // const validation = validateRecursive(type.$propertyPath.valueType, current, allTypes)
    // if (validation.result === 'fail') return toResult('The value under final key did not have the desired type', value)
    // return toResult(`The value under the requried key ${key} must be an object`, value)
  }

  return { result: 'pass', output: [] }
}

const validateAnd = (value: InputTypes, validator: AndType, depth: number, customTypes: Custom):
ValidationResult => {
  const onError = (resolvedType: any): ValidationResult =>
    failValidation('SCHEMA error: $and must only contain objects', resolvedType, depth)

  const combined = combineValidationObjects(validator, customTypes, onError)
  if (combined.result === 'error') return combined.error

  return validateObject(value, combined.pass, depth, customTypes)
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

const toResult = (res: SimpleValidation, value: InputTypes, depth: number): ValidationResult =>
  ({ result: res ? 'fail' : 'pass', output: res ? { error: res, depth, value: omitDisplay(value) } : null })

export const validateRecursive = (
  type: ValueTypes,
  value: InputTypes,
  depth: number,
  validationRef: Custom): ValidationResult => {
  if (typeof type === 'undefined') throw new Error('Type for validation cannot be undefined')

  while (isSimpleType(type) && Boolean(validationRef.custom[type])) {
    type = validationRef.custom[type]
  }

  if (isSimpleType(type)) { return toResult(simpleValidation(type, value), value, depth) }

  if (Array.isArray(type)) { return validateOneOf(value, type, depth, validationRef) }

  if (isPropertyPath(type)) { return validatePropertyPath(value, type, depth, validationRef) }

  if (isArray(type)) { return validateArray(value, type, depth, validationRef) }

  if (isEnum(type)) { return toResult(validateString(value, type.$enum), value, depth) }

  if (isKeyOf(type)) { return validateKeyOf(value, type, depth, validationRef) }

  if (isMap(type)) { return validateMap(value, type, depth, validationRef) }

  if (isNumber(type)) { return toResult(validateNumberComplex(value, type), value, depth) }

  if (isMeta(type)) { return validateRecursive(type.$type, value, depth + 1, validationRef) }

  if (isString(type)) { return toResult(validateStringObject(value, type), value, depth) }

  if (isAnd(type)) { return validateAnd(value, type, depth, validationRef) }

  if (isLiteral(type)) {
    return toResult(value === type.$literal ? '' : `Value did not match literal: ${String(type.$literal)}`, value, depth)
  }

  if (isTuple(type)) {
    if (!Array.isArray(value)) {
      return toResult('Value must be an array for tuple type', value, depth)
    }

    if (value.length > type.$tuple.length) {
      return toResult('Array larger then tuple', value, depth)
    }
    const results = type.$tuple.map((validation, index) => validateRecursive(validation, value[index], depth + 1, validationRef))
    const failed = results.some(x => x.result === 'fail')
    const output: ValidationOutputs = {
      error: 'objectResult',
      depth: Math.max(depth, getMaxDepth(results.map(x => x.output).flat())),
      errorCount: results.reduce((p, c) => p + (c.result === 'fail' ? 1 : 0), 0),
      objectResults: results.reduce((p: { [key: number]: ValidationOutputs }, c, i) => {
        p[i] = c.output
        return p
      }, {})
    }

    return {
      result: failed ? 'fail' : 'pass',
      output: {
        error: 'Some values did not match expected types',
        depth: Math.max(depth, getMaxDepth(output)),
        output,
        value: omitDisplay(value)
      }
    }
  }

  if (isObj(type)) { return validateObject(value, type, depth, validationRef) }

  throw new Error(`Unknown validator:${JSON.stringify(type)}`)
}

export const validate = (type: Validation, value: InputTypes): ValidationResult => {
  const processedType = processCustomTypes(type)
  return validateRecursive(processedType.validation, value, 0,
    { root: value, custom: processedType.customTypes })
}

export const loadJson = (json: string | object): Validation => {
  const jsonOut: any = typeof json === 'string' ? JSON.parse(json) : json
  delete jsonOut.$schema

  return jsonOut
}
