import {
  Validation, StringType, ArrayType, ObjectType, SimpleTypes,
  isSimpleType, isArray, isEnum, isObj,
  isObjectMeta, isMap, isNumber, isMeta, isString
} from './validationTypes'

type InputTypes = any | string | number | object | void | boolean | null
export type ValidationOutputs= ValidationOutput|ValidationOutput[]
export type ValidationOutput =
  | {[key: string]: ValidationOutputs}
  | null
  | {'error': string; output?: ValidationOutputs; value: any}

export type ValidationResult = {
  'result': 'pass'|'fail';
  output: ValidationOutputs;
}
export type ValidationFailed = {
  message: string;
}
type SimpleValidation = string | null
type validateFn = (type: Validation, value: InputTypes) => ValidationResult

const validateNullish = (value: InputTypes): SimpleValidation =>
  !(value === undefined) ? 'Value is not undefined' : null

const validateNumber = (value: InputTypes): SimpleValidation =>
  !Number.isFinite(value) || typeof value !== 'number' ? 'Value is not a number' : null

const validateNumberComplex = (value: InputTypes, min?: number, max?: number): SimpleValidation => {
  const res = validateNumber(value)
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
  else if (enums && enums.length && !enums.find(x => value === x)) { return `Value needs to be one of the following: [${enums.join(', ')}] ` }
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

const validateOneOf = (value: InputTypes, validator: Validation[], validate: validateFn):
 ValidationResult => {
  if (!validator.length) throw new Error('one of type needs at least one type')

  const errors: ValidationOutput[] = []
  for (const i of validator) {
    const result = validate(i, value)
    if (result.result === 'pass') return result
    if (Array.isArray(result.output)) result.output.forEach(x => errors.push(x))
    else errors.push(result.output)
  }

  return {
    result: 'fail',
    output:
  { error: 'Did not match any from the listed types', value, output: errors }
  }
}

const validateArray = (value: InputTypes, validator: ArrayType, validate: validateFn):
ValidationResult => {
  if (Array.isArray(value)) {
    const resultArray: ValidationOutputs[] = []
    let fail = false
    for (const x of value) {
      const res = validate(validator.$array, x)
      if (res.result === 'fail') fail = true
      resultArray.push(res.output)
    }
    return { result: fail ? 'fail' : 'pass', output: resultArray.flat() }
  }
  return { result: 'fail', output: { error: 'Value is not an Array', value } }
}

const validateObject = (value: InputTypes, validator: ObjectType, validate: validateFn):
 ValidationResult => {
  if (typeof value !== 'object' || value === null || value === undefined) { return { result: 'fail', output: { error: 'Value is not an Object', value } } }

  let fail = false
  const output: {[key: string]: ValidationOutputs} = {}
  for (const key of Object.keys(value).concat(Object.keys(validator))) {
    if (!validator[key]) {
      fail = true
      output[key] = { error: 'Key does not exist on validator', value: value[key] }
    } else {
      const { result, output: outputInternal } = validate(validator[key], value[key])
      if (result === 'fail') fail = true
      output[key] = outputInternal
    }
  }

  return { result: fail ? 'fail' : 'pass', output }
}

const validateMap = (value: InputTypes, validator: Validation, validate: validateFn):
 ValidationResult => {
  if (typeof value !== 'object' || value === null || value === undefined) { return { result: 'fail', output: { error: 'Value is not an Object', value } } }

  let fail = false
  const output: {[key: string]: ValidationOutputs} = {}
  for (const key of Object.keys(value)) {
    const { result, output: outputInternal } = validate(validator, value[key])
    if (result === 'fail') fail = true
    output[key] = outputInternal
  }
  return { result: fail ? 'fail' : 'pass', output }
}
const simpleValidation = (type: SimpleTypes, value: any): SimpleValidation => {
  switch (type) {
    case 'any': return null
    case '?': return validateNullish(value)
    case 'number': return validateNumber(value)
    case 'integer': return validateInteger(value)
    case 'string': return validateString(value)
    case 'boolean': return validateBool(value)
    default: throw new Error(`Unknown validator:${JSON.stringify(type)}`)
  }
}

const toResult = (res: SimpleValidation, value: InputTypes): ValidationResult =>
  ({ result: res ? 'fail' : 'pass', output: res ? { error: res, value } : null })

export const validate = (type: Validation, value: InputTypes): ValidationResult => {
  if (typeof type === 'undefined') throw new Error('Type for validation cannot be undefined')
  if (isSimpleType(type)) { return toResult(simpleValidation(type, value), value) }

  if (Array.isArray(type)) { return validateOneOf(value, type, validate) }

  if (isArray(type)) { return validateArray(value, type, validate) }

  if (isEnum(type)) { return toResult(validateString(value, type.$enum), value) }

  if (isObj(type)) { return validateObject(value, type, validate) }

  if (isObjectMeta(type)) { return validateObject(value, type.$object, validate) }

  if (isMap(type)) { return validateMap(value, type.$map, validate) }

  if (isNumber(type)) { return toResult(validateNumberComplex(value, type.$number.min, type.$number.max), value) }

  if (isMeta(type)) { return toResult(simpleValidation(type.$type, value), value) }

  if (isString(type)) { return toResult(validateStringObject(value, type), value) }

  throw new Error(`Unknown validator:${JSON.stringify(type)}`)
}

export const loadJson = (json: string | object): Validation => {
  const jsonOut = typeof json === 'string' ? JSON.parse(json) : json
  delete jsonOut.$schema

  return jsonOut
}
