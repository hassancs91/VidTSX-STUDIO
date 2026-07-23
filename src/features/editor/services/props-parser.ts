/**
 * AST-based extraction of editable props from a TSX composition's default export.
 *
 * Uses the TypeScript compiler's error-tolerant parser (no type checker), loaded
 * lazily so the large parser bundle lands in its own async chunk and never blocks
 * app startup. Only props that can be edited as primitives are returned:
 * string / number / boolean / string-literal unions, with a color heuristic for
 * string props that look like colors.
 */
import type * as TS from 'typescript';
import type { ExtractedProp, PropControl, PropValue } from '../types';

type TSModule = typeof TS;
type ComponentFn = TS.FunctionDeclaration | TS.FunctionExpression | TS.ArrowFunction;

interface TypeMemberInfo {
  control: PropControl | null;
  options?: string[];
}

let tsPromise: Promise<TSModule> | null = null;

function loadTypescript(): Promise<TSModule> {
  if (!tsPromise) {
    tsPromise = import('typescript').then(
      (mod) => ((mod as { default?: TSModule }).default ?? mod) as TSModule,
    );
  }
  return tsPromise;
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_NAME_RE = /color|colour|fill|stroke|tint/i;

export async function extractComponentProps(source: string): Promise<ExtractedProp[]> {
  if (!source.trim()) return [];
  const ts = await loadTypescript();
  return extract(ts, source);
}

function extract(ts: TSModule, source: string): ExtractedProp[] {
  const sf = ts.createSourceFile(
    'component.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = findDefaultExportFunction(ts, sf);
  const param = fn?.parameters[0];
  if (!param) return [];

  const typeMembers = param.type
    ? resolveTypeMembers(ts, sf, param.type)
    : new Map<string, TypeMemberInfo>();
  const results: ExtractedProp[] = [];

  const push = (name: string, defaultValue: PropValue | null): void => {
    const typeInfo = typeMembers.get(name);
    let control = typeInfo?.control ?? controlFromValue(defaultValue);
    if (!control) return;
    if (control === 'text' && looksLikeColor(name, defaultValue)) control = 'color';
    const prop: ExtractedProp = { name, control, defaultValue };
    if (typeInfo?.options) prop.options = typeInfo.options;
    results.push(prop);
  };

  if (ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (el.dotDotDotToken) continue;
      const name = bindingPropertyName(ts, el);
      if (!name) continue;
      push(name, el.initializer ? literalValue(ts, el.initializer) : null);
    }
  } else if (ts.isIdentifier(param.name)) {
    // Un-destructured `props` parameter — extract names from the type only.
    for (const name of typeMembers.keys()) push(name, null);
  }
  return results;
}

function findDefaultExportFunction(ts: TSModule, sf: TS.SourceFile): ComponentFn | null {
  for (const stmt of sf.statements) {
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) &&
      stmt.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return stmt;
    }
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const expr = stmt.expression;
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return expr;
      if (ts.isIdentifier(expr)) return resolveIdentifier(ts, sf, expr.text);
    }
  }
  return null;
}

function resolveIdentifier(ts: TSModule, sf: TS.SourceFile, name: string): ComponentFn | null {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) return stmt;
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === name &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          return decl.initializer;
        }
      }
    }
  }
  return null;
}

function resolveTypeMembers(
  ts: TSModule,
  sf: TS.SourceFile,
  typeNode: TS.TypeNode,
): Map<string, TypeMemberInfo> {
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const name = typeNode.typeName.text;
    for (const stmt of sf.statements) {
      if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === name) {
        return membersFrom(ts, stmt.members);
      }
      if (
        ts.isTypeAliasDeclaration(stmt) &&
        stmt.name.text === name &&
        ts.isTypeLiteralNode(stmt.type)
      ) {
        return membersFrom(ts, stmt.type.members);
      }
    }
  }
  if (ts.isTypeLiteralNode(typeNode)) return membersFrom(ts, typeNode.members);
  return new Map();
}

function membersFrom(
  ts: TSModule,
  members: readonly TS.TypeElement[],
): Map<string, TypeMemberInfo> {
  const map = new Map<string, TypeMemberInfo>();
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.type || !member.name) continue;
    const name = ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
      ? member.name.text
      : null;
    if (!name) continue;
    map.set(name, controlFromTypeNode(ts, member.type));
  }
  return map;
}

function controlFromTypeNode(ts: TSModule, node: TS.TypeNode): TypeMemberInfo {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { control: 'text' };
    case ts.SyntaxKind.NumberKeyword:
      return { control: 'number' };
    case ts.SyntaxKind.BooleanKeyword:
      return { control: 'boolean' };
  }
  if (ts.isUnionTypeNode(node)) {
    const options: string[] = [];
    let booleans = 0;
    for (const t of node.types) {
      if (!ts.isLiteralTypeNode(t)) return { control: null };
      if (ts.isStringLiteral(t.literal)) {
        options.push(t.literal.text);
      } else if (
        t.literal.kind === ts.SyntaxKind.TrueKeyword ||
        t.literal.kind === ts.SyntaxKind.FalseKeyword
      ) {
        booleans += 1;
      } else {
        return { control: null };
      }
    }
    if (options.length > 0 && booleans === 0) return { control: 'select', options };
    if (options.length === 0 && booleans > 0) return { control: 'boolean' };
  }
  return { control: null };
}

function bindingPropertyName(ts: TSModule, el: TS.BindingElement): string | null {
  if (el.propertyName && ts.isIdentifier(el.propertyName)) return el.propertyName.text;
  if (!el.propertyName && ts.isIdentifier(el.name)) return el.name.text;
  return null;
}

function literalValue(ts: TSModule, expr: TS.Expression): PropValue | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return -Number(expr.operand.text);
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  return null;
}

function controlFromValue(value: PropValue | null): PropControl | null {
  switch (typeof value) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return null;
  }
}

function looksLikeColor(name: string, defaultValue: PropValue | null): boolean {
  if (COLOR_NAME_RE.test(name)) return true;
  return typeof defaultValue === 'string' && HEX_COLOR_RE.test(defaultValue);
}
