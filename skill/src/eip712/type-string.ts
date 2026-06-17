// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import type { TypeDefinitions, TypedField } from "./types.js";

function renderType(name: string, fields: TypedField[]): string {
  const inner = fields.map((field) => `${field.type} ${field.name}`).join(",");
  return `${name}(${inner})`;
}

function getBaseType(type: string): string {
  const arrayIndex = type.indexOf("[");
  return arrayIndex === -1 ? type : type.slice(0, arrayIndex);
}

function collectDependencies(
  primaryType: string,
  types: TypeDefinitions,
  collected: Set<string>,
): void {
  const fields = types[primaryType];
  if (!fields) throw new Error(`Type "${primaryType}" not found in type definitions`);

  for (const field of fields) {
    const dependency = getBaseType(field.type);
    if (dependency === primaryType || collected.has(dependency) || !types[dependency]) continue;
    collected.add(dependency);
    collectDependencies(dependency, types, collected);
  }
}

export function buildTypeString(primaryType: string, fields: TypedField[]): string {
  return renderType(primaryType, fields);
}

export function buildCanonicalTypeString(primaryType: string, types: TypeDefinitions): string {
  const fields = types[primaryType];
  if (!fields) throw new Error(`Type "${primaryType}" not found in type definitions`);

  const dependencies = new Set<string>();
  collectDependencies(primaryType, types, dependencies);

  return [primaryType, ...Array.from(dependencies).sort()]
    .map((typeName) => renderType(typeName, types[typeName]))
    .join("");
}
