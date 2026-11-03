import {
  createCompilerHost,
  createProgram,
  forEachChild,
  isArrayBindingPattern,
  isBlock,
  isArrayLiteralExpression,
  isArrowFunction,
  isAsExpression,
  isBinaryExpression,
  isBindingElement,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLike,
  isIdentifier,
  isJsxAttribute,
  isJsxExpression,
  isNoSubstitutionTemplateLiteral,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParameter,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isReturnStatement,
  isSatisfiesExpression,
  isStringLiteral,
  isTemplateExpression,
  isVariableDeclaration,
  JsxEmit,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  SymbolFlags,
  SyntaxKind,
  type ArrayLiteralExpression,
  type BindingName,
  type Declaration,
  type Expression,
  type FunctionLikeDeclaration,
  type Node,
  type NoSubstitutionTemplateLiteral,
  type ObjectLiteralExpression,
  type StringLiteral,
  type TemplateLiteralLikeNode,
  type TypeChecker,
} from "typescript";

/**
 * The string parts that end up in a class attribute, found from where they
 * are used rather than from what they look like: a value is a class string
 * when it flows into one, whether or not its classes exist.
 *
 * The roots are the `className` (or `*ClassName`) attributes, and every
 * constant or function named for classes (`CARD_CLASSES`, `linkClasses`,
 * `className`), used or not. From a root the walk follows the branches of
 * `?:`, `&&`, `||`, `??` and `+`, template literals, constants and
 * imports, the functions called (their return values), records indexed by
 * a key (`VARIANTS[variant]`, `SIZES[size].box`), and the parameters of a
 * `.map` callback over an array literal (`SURFACES.map(([name, surface]) =>
 * …)`). Conditions, call arguments and anything else are not class strings.
 */

export type ClassPart = {
  readonly file: string;
  readonly text: string;
  /** An expression is glued to its start or its end (no space between). */
  readonly gluedStart: boolean;
  readonly gluedEnd: boolean;
};

type Leaf =
  StringLiteral | NoSubstitutionTemplateLiteral | TemplateLiteralLikeNode;

/** A name for classes: `CARD_CLASSES`, `TYPE_CLASSES`, `linkClasses`, `className`. */
const CLASS_NAME =
  /(?:^|_)CLASS(?:ES)?$|(?:^|[a-z])Class(?:es|Name)?$|^class(?:es|Name)?$/;

/** An attribute that takes classes: `className`, `iconClassName`. */
const CLASS_ATTRIBUTE = /^(?:className|[a-z]\w*ClassName)$/;

/** Array methods whose callback receives each element first. */
const ELEMENT_CALLBACKS = new Set(["map", "flatMap", "forEach", "filter"]);

function strip(node: Expression): Expression {
  let current = node;
  while (
    isParenthesizedExpression(current) ||
    isAsExpression(current) ||
    isSatisfiesExpression(current) ||
    isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** The values `fn` returns (not those of functions nested in it). */
function returnValues(fn: FunctionLikeDeclaration): readonly Expression[] {
  const body = fn.body;
  if (!body) return [];
  if (!isBlock(body)) return [body];
  const found: Expression[] = [];
  const visit = (node: Node) => {
    if (isReturnStatement(node)) {
      if (node.expression) found.push(node.expression);
      return;
    }
    if (isFunctionLike(node)) return;
    forEachChild(node, visit);
  };
  forEachChild(body, visit);
  return found;
}

/** A property's values; every property's when `key` is undefined. */
function propertyValues(
  object: ObjectLiteralExpression,
  key: string | undefined
): readonly Expression[] {
  return object.properties.flatMap(property =>
    isPropertyAssignment(property) &&
    (key === undefined ||
      ((isIdentifier(property.name) || isStringLiteral(property.name)) &&
        property.name.text === key))
      ? [property.initializer]
      : []
  );
}

/**
 * The walk over one program. Every resolution step is guarded by the
 * nodes on the current path (`path`), so a cycle ends and a value reached
 * twice by different paths is still read both times.
 */
function walkerFor(checker: TypeChecker) {
  const leaves = new Set<Leaf>();

  const guarded = <T>(
    node: Node,
    path: ReadonlySet<Node>,
    step: (inner: ReadonlySet<Node>) => readonly T[]
  ): readonly T[] => (path.has(node) ? [] : step(new Set([...path, node])));

  /** The declarations `identifier` names, through imports. */
  const declarations = (identifier: Node): readonly Declaration[] => {
    let symbol = checker.getSymbolAtLocation(identifier);
    if (symbol && symbol.flags & SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    return symbol?.declarations ?? [];
  };

  /**
   * What a parameter or a destructuring receives: a `.map` callback's
   * first parameter gets each element of the array literal it runs over.
   */
  const ownerValues = (
    owner: Node,
    path: ReadonlySet<Node>
  ): readonly Expression[] => {
    if (isVariableDeclaration(owner)) {
      return owner.initializer ? [owner.initializer] : [];
    }
    if (isBindingElement(owner)) return declarationValues(owner, path);
    if (!isParameter(owner)) return [];
    const callback = owner.parent;
    if (
      !(isArrowFunction(callback) || isFunctionExpression(callback)) ||
      callback.parameters[0] !== owner
    ) {
      return [];
    }
    const call = callback.parent;
    if (
      !isCallExpression(call) ||
      call.arguments[0] !== callback ||
      !isPropertyAccessExpression(call.expression) ||
      !ELEMENT_CALLBACKS.has(call.expression.name.text)
    ) {
      return [];
    }
    return arrays(call.expression.expression, path).flatMap(
      array => array.elements
    );
  };

  /** The expressions a declared name can hold. */
  const declarationValues = (
    declaration: Declaration,
    path: ReadonlySet<Node>
  ): readonly Expression[] =>
    guarded(declaration, path, inner => {
      if (isVariableDeclaration(declaration)) {
        return declaration.initializer ? [declaration.initializer] : [];
      }
      if (isParameter(declaration)) return ownerValues(declaration, inner);
      if (!isBindingElement(declaration)) return [];
      const pattern = declaration.parent;
      const sources = ownerValues(pattern.parent, inner);
      if (isArrayBindingPattern(pattern)) {
        const index = pattern.elements.indexOf(declaration);
        return sources.flatMap(source =>
          arrays(source, inner).flatMap(array => {
            const element = array.elements[index];
            return element ? [element] : [];
          })
        );
      }
      const key = (declaration.propertyName ?? declaration.name).getText();
      return sources.flatMap(source =>
        objects(source, inner).flatMap(object => propertyValues(object, key))
      );
    });

  const nameValues = (name: Node, path: ReadonlySet<Node>) =>
    declarations(name).flatMap(declaration =>
      declarationValues(declaration, path)
    );

  /** The array literals `node` can be. */
  const arrays = (
    node: Expression,
    path: ReadonlySet<Node>
  ): readonly ArrayLiteralExpression[] => {
    const value = strip(node);
    if (isArrayLiteralExpression(value)) return [value];
    if (!isIdentifier(value)) return [];
    return nameValues(value, path).flatMap(expression =>
      arrays(expression, path)
    );
  };

  /** The object literals `node` can be. */
  const objects = (
    node: Expression,
    path: ReadonlySet<Node>
  ): readonly ObjectLiteralExpression[] => {
    const value = strip(node);
    if (isObjectLiteralExpression(value)) return [value];
    if (isIdentifier(value)) {
      return nameValues(value, path).flatMap(expression =>
        objects(expression, path)
      );
    }
    if (isPropertyAccessExpression(value) || isElementAccessExpression(value)) {
      return accessed(value, path).flatMap(expression =>
        objects(expression, path)
      );
    }
    return [];
  };

  /**
   * What `object.key` or `object[key]` can be (a key that isn't a literal
   * can be any property). Cycles can only pass through a declaration, which
   * is guarded.
   */
  const accessed = (
    node: Expression,
    path: ReadonlySet<Node>
  ): readonly Expression[] => {
    if (isPropertyAccessExpression(node)) {
      return objects(node.expression, path).flatMap(object =>
        propertyValues(object, node.name.text)
      );
    }
    if (!isElementAccessExpression(node)) return [];
    const key = strip(node.argumentExpression);
    const literal =
      isStringLiteral(key) || isNoSubstitutionTemplateLiteral(key)
        ? key.text
        : undefined;
    return [
      ...objects(node.expression, path).flatMap(object =>
        propertyValues(object, literal)
      ),
      ...arrays(node.expression, path).flatMap(array => array.elements),
    ];
  };

  /** The return values of the functions `callee` names. */
  const returned = (
    callee: Expression,
    path: ReadonlySet<Node>
  ): readonly Expression[] =>
    isIdentifier(callee)
      ? declarations(callee).flatMap(declaration =>
          guarded(declaration, path, () => {
            if (isFunctionDeclaration(declaration)) {
              return returnValues(declaration);
            }
            if (!isVariableDeclaration(declaration)) return [];
            const value =
              declaration.initializer && strip(declaration.initializer);
            return value &&
              (isArrowFunction(value) || isFunctionExpression(value))
              ? returnValues(value)
              : [];
          })
        )
      : [];

  /** Records every string part `node` can put in a class attribute. */
  const visit = (node: Expression, path: ReadonlySet<Node> = new Set()) => {
    const value = strip(node);
    guarded(value, path, inner => {
      const next = (expressions: readonly Expression[]) => {
        for (const expression of expressions) visit(expression, inner);
      };
      if (isStringLiteral(value) || isNoSubstitutionTemplateLiteral(value)) {
        leaves.add(value);
      } else if (isTemplateExpression(value)) {
        leaves.add(value.head);
        for (const span of value.templateSpans) {
          visit(span.expression, inner);
          leaves.add(span.literal);
        }
      } else if (isConditionalExpression(value)) {
        next([value.whenTrue, value.whenFalse]);
      } else if (isBinaryExpression(value)) {
        const operator = value.operatorToken.kind;
        if (operator === SyntaxKind.AmpersandAmpersandToken) {
          next([value.right]);
        } else if (
          operator === SyntaxKind.BarBarToken ||
          operator === SyntaxKind.QuestionQuestionToken ||
          operator === SyntaxKind.PlusToken
        ) {
          next([value.left, value.right]);
        }
      } else if (isIdentifier(value)) {
        next(nameValues(value, inner));
      } else if (isCallExpression(value)) {
        next(returned(value.expression, inner));
      } else if (
        isPropertyAccessExpression(value) ||
        isElementAccessExpression(value)
      ) {
        next(accessed(value, inner));
      } else if (isObjectLiteralExpression(value)) {
        // A record of class strings named for classes (`TYPE_CLASSES`).
        next(propertyValues(value, undefined));
      }
      return [];
    });
  };

  return { visit, leaves: () => [...leaves] };
}

const isClassName = (name: BindingName | undefined) =>
  name !== undefined && isIdentifier(name) && CLASS_NAME.test(name.text);

/**
 * Every string part that ends up in a class attribute, in `sources` (path
 * → TypeScript source; imports between them are followed, `~/` being
 * `<root>/app/`).
 */
export function classParts(
  root: string,
  sources: ReadonlyMap<string, string>
): readonly ClassPart[] {
  const absolute = new Map(
    [...sources].map(([path, source]) => [`${root}/${path}`, source])
  );
  const options = {
    jsx: JsxEmit.ReactJSX,
    module: ModuleKind.Preserve,
    moduleResolution: ModuleResolutionKind.Bundler,
    target: ScriptTarget.Latest,
    paths: { "~/*": [`${root}/app/*`] },
    noLib: true,
    noResolve: true,
    types: [],
  };
  const host = createCompilerHost(options);
  host.fileExists = path => absolute.has(path);
  host.readFile = path => absolute.get(path);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, version, onError, create) =>
    absolute.has(path)
      ? getSourceFile(path, version, onError, create)
      : undefined;
  const program = createProgram([...absolute.keys()], options, host);
  const walker = walkerFor(program.getTypeChecker());

  const files = new Map<Node, string>();
  for (const [path] of sources) {
    const file = program.getSourceFile(`${root}/${path}`);
    if (!file) throw new Error(`No source for ${path}`);
    files.set(file, path);
    const visit = (node: Node) => {
      if (
        isJsxAttribute(node) &&
        CLASS_ATTRIBUTE.test(node.name.getText()) &&
        node.initializer
      ) {
        if (isStringLiteral(node.initializer)) walker.visit(node.initializer);
        else if (
          isJsxExpression(node.initializer) &&
          node.initializer.expression
        ) {
          walker.visit(node.initializer.expression);
        }
      } else if (
        isVariableDeclaration(node) &&
        isClassName(node.name) &&
        node.initializer
      ) {
        walker.visit(node.initializer);
      } else if (isFunctionDeclaration(node) && isClassName(node.name)) {
        for (const value of returnValues(node)) walker.visit(value);
      }
      forEachChild(node, visit);
    };
    visit(file);
  }

  return walker.leaves().map(leaf => {
    const kind = leaf.kind;
    return {
      file: files.get(leaf.getSourceFile()) ?? leaf.getSourceFile().fileName,
      text: leaf.text,
      gluedStart:
        (kind === SyntaxKind.TemplateMiddle ||
          kind === SyntaxKind.TemplateTail) &&
        /^\S/.test(leaf.text),
      gluedEnd:
        (kind === SyntaxKind.TemplateHead ||
          kind === SyntaxKind.TemplateMiddle) &&
        /\S$/.test(leaf.text),
    };
  });
}
