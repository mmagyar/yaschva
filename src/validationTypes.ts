type NonEmptyArray<T> = [T, ...T[]]
export interface TypeMeta {name?: string, description?: string}
type CustomValueType = string // Maybe use nominal typing to prevent arbitrary strings
export type ValueTypes = ValueType | NonEmptyArray<ValueType>
export type TypeDef = {$types: {[key: string]: ValueTypes}} & ObjectType
export type Validation = ValueTypes | TypeDef
export type SimpleTypes = 'string' | 'boolean' | 'number' | 'integer' | 'null' | '?' | 'any' | CustomValueType
export interface ObjectType { [key: string]: ValueTypes }
export type EnumType = TypeMeta & { $enum: string[] }
export type KeyOfType = TypeMeta & { $keyOf: string[], valueType?: ValueTypes }
export type ArrayType = TypeMeta & { $array: ValueTypes, minLength?: number, maxLength?: number}
export type LiteralType = TypeMeta & {$literal: string | number | null }
export type TupleType = TypeMeta & {$tuple: NonEmptyArray<ValueType>}
export type MapType = TypeMeta & { $map: ValueTypes
  minLength?: number
  maxLength?: number
  key?: StringType | EnumType | KeyOfType
  keySpecificType?: {[key: string]: ValueTypes} }
export type AndType = TypeMeta & { $and: Array<ObjectType | CustomValueType> }
export type StringType = TypeMeta & {
  select?: string
  $string: {
    minLength?: number
    maxLength?: number
    regex?: string
    rootKey?: boolean
  }
}
export declare type NumberType = TypeMeta & {
  $number: { min?: number, max?: number, integer?: boolean }
}
export interface PropertyPathType {
  $propertyPath: {
    onlyObjects?: boolean
  }
}

export declare type MetaType = TypeMeta & { $type: ValueTypes }

export type ValueType =
  | SimpleTypes
  | EnumType
  | ObjectType
  | ArrayType
  | StringType
  | NumberType
  | MetaType
  | MapType
  | AndType
  | KeyOfType
  | LiteralType
  | TupleType
  | PropertyPathType

export const isSimpleType = (tbd: any): tbd is SimpleTypes => typeof tbd === 'string'
export const isArray = (tbd: any): tbd is ArrayType => tbd?.$array
export const isMap = (tbd: any): tbd is MapType => tbd?.$map
export const isString = (tbd: any): tbd is StringType => tbd?.$string
export const isNumber = (tbd: any): tbd is NumberType => tbd?.$number
export const isMeta = (tbd: any): tbd is MetaType => tbd?.$type
export const isEnum = (tbd: any): tbd is EnumType => typeof tbd?.$enum !== 'undefined'
export const isObj = (tbd: any): tbd is ObjectType =>
  tbd instanceof Object && !Object.keys(tbd).some(x => x.startsWith('$'))
export const isTypeDefValidation = (tbd: any): tbd is TypeDef => tbd?.$types
export const isAnd = (tbd: any): tbd is AndType => tbd?.$and
export const isKeyOf = (tbd: any): tbd is KeyOfType => tbd?.$keyOf
export const isLiteral = (tbd: any): tbd is LiteralType => typeof tbd?.$literal !== 'undefined'
export const isTuple = (tbd: any): tbd is TupleType => tbd?.$tuple
export const isPropertyPath = (tbd: any): tbd is PropertyPathType => tbd?.$propertyPath
