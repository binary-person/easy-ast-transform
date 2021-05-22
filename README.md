# easy-ast-transform

> Transforming and modifying a JS AST tree simplified.


## Purpose

Say you want to transform this

```js
function func(a, b, c) {
  return a + b + c;
}
```

into

```js
function func(a, b, c) {
  return a - b / c;
}
```

That would take a lot of work. You will need to traverse through the AST, write an uncountable amount of if statements, and finally modify it.

With this, you can simply put in a before and after "template" AST node, and this library will search through the AST according to your specifications and modify it accordingly.

## Examples

Let's transform the above code. (Using recast is recommended and is perfect when used in combination with this library, but using acorn + astring.generate works as well).

```js
const EasyAstTransform = require('easy-ast-transform');
const recast = require('recast');

let templateBefore = recast.parse('function func(a, b, c) { return a + b + c; }');
let templateAfter = recast.parse('function func(a, b, c) { return a - b / c; }');

let inputAst = recast.parse('(function() { function func(a, b, c) { return a + b + c; } })()');

let transformer = new EasyAstTransform(templateBefore.program.body, templateAfter.program.body);
transformer.transform(inputAst); // returns 1 for the number of occurrences replaced

recast.print(inputAst).code === '(function() { function func(a, b, c) { return a - b / c; } })()';
```

You can also make the transformer more generalized by adding `GENERAL_` before your identifier to specify which ones are generalized, using `PLACEHOLDER` to match all the remaining body or `PLACEHOLDER_1` to match one node.

```js
templateBefore = recast.parse('function GENERAL_someFunc(a, b, c) { PLACEHOLDER; return a + b + c; }');
templateAfter = recast.parse('function GENERAL_someFunc(a, b, c) { PLACEHOLDER; return a - b / c; }');

inputAst = recast.parse(`
(function() {
  function func(a, b, c) {
    if (a > b + c) a += b - c;
    while (false) {
      console.log('More stuff here');
    }
    switch (3) {
      case 'I believe':
        break;
      case 'you get the point':
        break;
    }
    return a + b + c;
  }
})();`);

transformer = new EasyAstTransform(templateBefore.program.body, templateAfter.program.body, {
  generalizedPrefix: 'GENERAL_',
  placeholder: 'PLACEHOLDER'
});
transformer.transform(inputAst); // returns 1

recast.print(inputAst).code === `
(function() {
  function func(a, b, c) {
    if (a > b + c) a += b - c;
    while (false) {
      console.log('More stuff here');
    }
    switch (3) {
      case 'I believe':
        break;
      case 'you get the point':
        break;
    }
    return a - b / c;
  }
})();`;
```

See [test cases](/src/testCases.test.ts) for more examples.

## Sidenote

An area of possible unexpected behavior would be attempting to convert a node wrapped in an ExpressionStatement node, for example, `GENERAL_a + GENERAL_b` to `GENERAL_a - GENERAL_b`.

```js
templateBefore = recast.parse('GENERAL_a + GENERAL_b');
templateAfter = recast.parse('GENERAL_a - GENERAL_b');

inputAst = recast.parse('function a() { return a + b }');

transformer = new EasyAstTransform(templateBefore.program.body, templateAfter.program.body);
transformer.transform(inputAst); // returns 0

recast.print(inputAst).code !== 'function a() { return a - b;}';
```

Why? `EasyAstTransform` cannot find any `ExpressionStatement` in `return a + b`. The latter is actually wrapped in a `ReturnStatement` node.

To fix this, be sure to specify the expression node inside `ExpressionStatement`

```js
// arguments to EasyAstTransform only accept an array of AST nodes. Be sure to wrap them in [] if you're specifying a single node
transformer = new EasyAstTransform([templateBefore.program.body[0].expression], [templateAfter.program.body[0].expression]);
transformer.transform(inputAst); // returns 1

recast.print(inputAst).code === 'function a() { return a - b;}';
```

## License

Apache-2.0
