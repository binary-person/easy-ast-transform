import recast = require('recast');
import EasyAstTransform = require('.');

type testCaseType = {
    description?: string;
    beforeCode: string | ASTTree[];
    afterCode: string | ASTTree[];
    inputCode: string;
    expectedCode: string;
    expectedOccurrences: number;
};

const testCases: testCaseType[] = [
    {
        description: 'Simple a + b to a - b case',
        beforeCode: 'a + b',
        afterCode: 'a - b',
        inputCode: 'a + b',
        expectedCode: 'a - b',
        expectedOccurrences: 1
    },
    {
        description: 'a + b to a - b inside a function',
        beforeCode: 'function a() {return a + b}',
        afterCode: 'function a() {return a - b}',
        inputCode: 'function a() {return a + b}',
        expectedCode: 'function a() {return a - b}',
        expectedOccurrences: 1
    },
    {
        description: 'a + b to a - b inside a function inside an anonymous function',
        beforeCode: 'function a() {return a + b}',
        afterCode: 'function a() {return a - b}',
        inputCode: '(function() { function a() {return a + b} })()',
        expectedCode: '(function() { function a() {return a - b} })()',
        expectedOccurrences: 1
    },
    {
        description: 'different identifiers should not replace',
        beforeCode: 'function a() {return a + b}',
        afterCode: 'function a() {return a - b}',
        inputCode: '(function() { function b() {return a + b} })()',
        expectedCode: '(function() { function b() {return a + b} })()',
        expectedOccurrences: 0
    },
    {
        description: 'generalized identifiers should replace',
        beforeCode: 'function GENERAL_func() {return a + b}',
        afterCode: 'function GENERAL_func() {return a - b}',
        inputCode: '(function() { function b() {return a + b} })()',
        expectedCode: '(function() { function b() {return a - b} })()',
        expectedOccurrences: 1
    },
    {
        description: 'a + b to a - b should not replace because it is an ExpressionStatement statement',
        beforeCode: 'a + b',
        afterCode: 'a - b',
        inputCode: '(function() { function b() {return a + b} })()',
        expectedCode: '(function() { function b() {return a + b} })()',
        expectedOccurrences: 0
    },
    {
        description: 'a + b to a - b should replace because it is a BinaryExpression statement',
        beforeCode: [
            {
                type: 'BinaryExpression',
                left: { type: 'Identifier', name: 'a' },
                operator: '+',
                right: { type: 'Identifier', name: 'b' }
            }
        ],
        afterCode: [
            {
                type: 'BinaryExpression',
                left: { type: 'Identifier', name: 'a' },
                operator: '-',
                right: { type: 'Identifier', name: 'b' }
            }
        ],
        inputCode: '(function() { function b() {return a + b} })()',
        expectedCode: '(function() { function b() {return a - b;} })()',
        expectedOccurrences: 1
    },
    {
        description: 'removing labels and PLACEHOLDERs work',
        beforeCode: 'GENERAL_label: {while(PLACEHOLDER) {PLACEHOLDER}}',
        afterCode: 'while(PLACEHOLDER) {PLACEHOLDER}',
        inputCode: 'label1: {while(i--) {somecode(); here(); if (i % 2) i -= 1;}}',
        expectedCode: 'while (i--) {\n  somecode();here();if (i % 2) i -= 1;\n}',
        expectedOccurrences: 1
    },
    {
        description: 'replacing multiple instances in a list of statements works',
        beforeCode: 'GENERAL_var += 3;',
        afterCode: 'GENERAL_var += 1;',
        inputCode: 'a += 2; a += 3; a += 3; a += 2;',
        expectedCode: 'a += 2; a += 1; a += 1; a += 2;',
        expectedOccurrences: 2
    }
];

interface ASTTree {
    [prop: string]: any;
    type: string;
    body?: ASTTree | ASTTree[];
    name?: string;
    expression?: ASTTree;
}

const codeToAstBody = (code: string | ASTTree[]): ASTTree[] => {
    if (Array.isArray(code)) return code;
    const parsed = recast.parse(code);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return parsed.program.body as ASTTree[];
};

describe('EasyAstTransform test cases', () => {
    let count = 1;
    for (const testCase of testCases) {
        it(`Test case #${count}${testCase.description ? ': ' + testCase.description : ''}`, () => {
            const transformer = new EasyAstTransform(
                codeToAstBody(testCase.beforeCode),
                codeToAstBody(testCase.afterCode)
            );
            const inputAst = recast.parse(testCase.inputCode);
            const occurrences = transformer.transform(inputAst);
            try {
                expect(recast.print(inputAst).code).toBe(testCase.expectedCode);
            } catch (e) {
                debugger; // used for debugging failed test cases
                transformer.templateBeforeAst = codeToAstBody(testCase.beforeCode);
                transformer.templateAfterAst = codeToAstBody(testCase.afterCode);
                transformer.transform(recast.parse(testCase.inputCode));
                throw e;
            }
            expect(occurrences).toBe(testCase.expectedOccurrences);
        });
        count++;
    }
});
