export type Common = {
  default: any;
}
export declare type TypeMeta = {
  name?: string;
  description?: string;
  onlyIn?: 'request' | 'response';
};

type CustomValueType = string // Maybe use nominal typing to prevent arbitrary strings
export type ValueTypes = ValueType | ValueType[]
export type TypeDef = {$types: {[key:string]:ValueTypes}} & ObjectType
export type Validation = ValueTypes | TypeDef
export type SimpleTypes = 'string' | 'boolean' | 'number' | 'integer' | 'null' | '?' | 'any' | CustomValueType;
export type ObjectType = { [key: string]: ValueTypes };
export type EnumType = TypeMeta & {showSelect?: boolean; $enum: string[]};
export type ArrayType = TypeMeta & { multiSelect?: string; $array: ValueTypes};
export type ObjectMetaType = TypeMeta & {
  $object: ObjectType;
};
export type MapType = TypeMeta & {
  $map: ValueTypes;
}
export type StringType = TypeMeta &
{ select?: string;$string: {minLength?: number;maxLength?: number;regex?: string}};
export declare type NumberType = TypeMeta & {
  postfix?: string;
  $number: {
    min?: number;
    max?: number;
    step?: number;
  };
};
export declare type MetaType = TypeMeta & { $type: SimpleTypes };

export type ValueType =
  | SimpleTypes
  | EnumType
  | ObjectType
  | ArrayType
  | ObjectMetaType
  | StringType
  | NumberType
  | MetaType
  | MapType;

export const isSimpleType = (tbd: any): tbd is SimpleTypes => typeof tbd === 'string'
export const isArray = (tbd: any): tbd is ArrayType => tbd.$array
export const isMap = (tbd: any): tbd is MapType => tbd.$map
export const isObjectMeta = (tbd: any): tbd is ObjectMetaType => tbd.$object
export const isString = (tbd: any): tbd is StringType => tbd.$string
export const isNumber = (tbd: any): tbd is NumberType => tbd.$number
export const isMeta = (tbd: any): tbd is MetaType => tbd.$type
export const isEnum = (tbd: any): tbd is EnumType => tbd.$enum
export const isObj = (tbd: any): tbd is ObjectType =>
  !Object.keys(tbd).some(x => x.startsWith('$'))
export const isTypeDefValidation = (tbd: any): tbd is TypeDef => tbd.$types
