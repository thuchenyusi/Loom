type Expr = (x: number) => number;
const functions: Record<string, { arity: number; evaluate: (...values: number[]) => number }> = {
  sin: { arity: 1, evaluate: Math.sin }, cos: { arity: 1, evaluate: Math.cos }, tan: { arity: 1, evaluate: Math.tan },
  sqrt: { arity: 1, evaluate: Math.sqrt }, abs: { arity: 1, evaluate: Math.abs }, exp: { arity: 1, evaluate: Math.exp },
  log: { arity: 1, evaluate: Math.log }, floor: { arity: 1, evaluate: Math.floor }, ceil: { arity: 1, evaluate: Math.ceil },
  min: { arity: 2, evaluate: Math.min }, max: { arity: 2, evaluate: Math.max }, pow: { arity: 2, evaluate: Math.pow },
};

/** Parse a bounded arithmetic grammar; never evaluate JavaScript from the DSL. */
export function compileExpression(expression: string): Expr {
  if (expression.length > 512) throw new SyntaxError('Expression is too long (maximum 512 characters)');
  const tokens: string[] = [];
  let offset = 0;
  while (offset < expression.length) {
    if (/\s/.test(expression[offset])) { offset++; continue; }
    const match = /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|\*\*|[+\-*/^(),])/.exec(expression.slice(offset));
    if (!match) throw new SyntaxError(`Unexpected character at position ${offset}`);
    tokens.push(match[0]); offset += match[0].length;
  }
  if (tokens.length > 256) throw new SyntaxError('Expression has too many tokens');
  let index = 0;
  let depth = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (token: string) => { if (take() !== token) throw new SyntaxError(`Expected "${token}"`); };
  const additive = (): Expr => {
    let left = multiplicative();
    while (peek() === '+' || peek() === '-') {
      const op = take(), a = left, b = multiplicative();
      left = op === '+' ? x => a(x) + b(x) : x => a(x) - b(x);
    }
    return left;
  };
  const multiplicative = (): Expr => {
    let left = unary();
    while (peek() === '*' || peek() === '/') {
      const op = take(), a = left, b = unary();
      left = op === '*' ? x => a(x) * b(x) : x => a(x) / b(x);
    }
    return left;
  };
  const unary = (): Expr => {
    if (++depth > 64) throw new SyntaxError('Expression is nested too deeply');
    let value: Expr;
    if (peek() === '+' || peek() === '-') {
      const op = take(), operand = unary();
      value = op === '-' ? x => -operand(x) : operand;
    } else {
      const base = atom();
      if (peek() === '^' || peek() === '**') {
        take(); const exponent = unary();
        value = x => base(x) ** exponent(x);
      } else value = base;
    }
    depth--;
    return value;
  };
  const atom = (): Expr => {
    const token = take();
    if (token === undefined) throw new SyntaxError('Expected a number, x, function or parenthesis');
    if (/^(?:\d|\.)/.test(token)) {
      const number = Number(token);
      if (!Number.isFinite(number)) throw new SyntaxError('Number must be finite');
      return () => number;
    }
    if (token === 'x') return x => x;
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (token === '(') { const value = additive(); expect(')'); return value; }
    if (Object.hasOwn(functions, token)) {
      const fn = functions[token];
      expect('(');
      const args: Expr[] = [additive()];
      while (peek() === ',') { take(); args.push(additive()); }
      expect(')');
      if (args.length !== fn.arity) throw new SyntaxError(`${token} requires ${fn.arity} argument(s)`);
      return x => fn.evaluate(...args.map(arg => arg(x)));
    }
    throw new SyntaxError(`Unsupported token "${token}"`);
  };
  const result = additive();
  if (index !== tokens.length) throw new SyntaxError(`Unexpected token "${peek()}"`);
  return result;
}
