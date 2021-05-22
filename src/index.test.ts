import EasyAstTransform = require('.');
import cloneDeep = require('clone-deep');

interface ASTTree {
    [prop: string]: any;
    type: string;
    body?: ASTTree | ASTTree[];
    name?: string;
    expression?: ASTTree;
}

describe('EasyAstTransform class unit tests', () => {
    const transformer = new EasyAstTransform([{ type: 'abc', another: '123' }], [{ type: 'abc', another: '123' }]);
    describe('nodeMatch method', () => {
        const testNode: ASTTree = { type: 'abc', another: '123' };
        it('throws error if given node is not an AST node but is an object', () => {
            expect(() =>
                transformer['nodeMatch'](testNode, { someOtherUnknownProp: 'abc' } as unknown as ASTTree)
            ).toThrowError('Unexpected node or matchNode to be an object while not being an AST node');
        });
        EasyAstTransform.prototype['nodesMatch'] = jest.fn(EasyAstTransform.prototype['nodesMatch']);
        it('calls nodesMatch if one of the props is an array', () => {
            transformer['nodeMatch']({ type: 'some1', test: [1, 2] }, { type: 'some1', test: [1, 2] });
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledTimes(1);
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledWith([1, 2], [1, 2], false);
        });
        it('returns false if types do not match', () => {
            expect(transformer['nodeMatch']({ type: 'some1', test: [1, 2] }, { type: 'some2', test: [1, 2] })).toBe(
                false
            );
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledTimes(1);
        });
        it('ignores props in options.ignoreProperties', () => {
            expect(transformer['nodeMatch']({ type: 'some1', start: 1 }, { type: 'some1', start: 2133 })).toBe(true);
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledTimes(1);
        });
        it('returns true if both are not nodes and not objects and are equal', () => {
            expect(transformer['nodeMatch'](1 as unknown as ASTTree, 1 as unknown as ASTTree)).toBe(true);
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledTimes(1);
        });
        it('returns false if both are not nodes and not objects and are not equal', () => {
            expect(transformer['nodeMatch'](1 as unknown as ASTTree, 2 as unknown as ASTTree)).toBe(false);
            expect(EasyAstTransform.prototype['nodesMatch']).toBeCalledTimes(1);
        });
        it('returns true if one is a node and one is PLACEHOLDER or PLACEHOLDER_1 and sets placeholderItems correctly', () => {
            const testNode: ASTTree = { type: 'something' };
            let placeholderNode: ASTTree = { type: 'Identifier', name: 'PLACEHOLDER' };
            expect(transformer['nodeMatch'](testNode, placeholderNode)).toBe(true);
            expect(placeholderNode).toStrictEqual({
                type: 'Identifier',
                name: 'PLACEHOLDER',
                placeholderItems: testNode
            });

            placeholderNode = { type: 'Identifier', name: 'PLACEHOLDER_1' };
            expect(transformer['nodeMatch'](testNode, placeholderNode)).toBe(true);
            expect(placeholderNode).toStrictEqual({
                type: 'Identifier',
                name: 'PLACEHOLDER_1',
                placeholderItems: testNode
            });

            placeholderNode = { type: 'Identifier', name: 'PLACEHOLDER_2' };
            expect(transformer['nodeMatch'](testNode, placeholderNode)).toBe(false);
            expect(placeholderNode).toStrictEqual({ type: 'Identifier', name: 'PLACEHOLDER_2' });

            // check testNode is still the same
            expect(testNode).toStrictEqual({ type: 'something' });
        });
        describe('generalized identifiers work as expected', () => {
            it("make sure it initially doesn't work without the GENERAL_ prefix", () => {
                expect(
                    transformer['nodeMatch'](
                        { type: 'Identifier', name: 'someFunc' },
                        { type: 'Identifier', name: 'stuff' }
                    )
                ).toBe(false);
                expect(
                    transformer['nodeMatch'](
                        { type: 'Identifier', name: 'someFunc' },
                        { type: 'Identifier', name: 'GENERAL_stuff' }
                    )
                ).toBe(true);
            });
            describe('check if the function retains memory of which generalized identifier goes to which', () => {
                it('make sure GENERAL_stuff still remembers someFunc', () => {
                    expect(
                        transformer['nodeMatch'](
                            { type: 'Identifier', name: 'someFunc' },
                            { type: 'Identifier', name: 'GENERAL_stuff' },
                            false // prevent erasure of general identifiers
                        )
                    ).toBe(true);
                });
                it('should remember initial generalized identifier and return false upon mismatch', () => {
                    expect(
                        transformer['nodeMatch'](
                            { type: 'Identifier', name: 'someOtherFunc' },
                            { type: 'Identifier', name: 'GENERAL_stuff' },
                            false // prevent erasure of general identifiers
                        )
                    ).toBe(false);
                });
                it('should return false when the target is already assigned to and used', () => {
                    expect(
                        transformer['nodeMatch'](
                            { type: 'Identifier', name: 'someFunc' },
                            { type: 'Identifier', name: 'GENERAL_secondstuff' },
                            false // prevent erasure of general identifiers
                        )
                    ).toBe(false);
                });
                it('make sure GENERAL_stuff still works', () => {
                    expect(
                        transformer['nodeMatch'](
                            { type: 'Identifier', name: 'someFunc' },
                            { type: 'Identifier', name: 'GENERAL_stuff' },
                            false // prevent erasure of general identifiers
                        )
                    ).toBe(true);
                });
                it('after erasure of general identifiers, GENERAL_secondstuff should be true', () => {
                    expect(
                        transformer['nodeMatch'](
                            { type: 'Identifier', name: 'someFunc' },
                            { type: 'Identifier', name: 'GENERAL_secondstuff' }
                        )
                    ).toBe(true);
                });
            });
        });
    });
    describe('nodesMatch method', () => {
        describe('general functionality', () => {
            const testNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                { type: '0abc', another: '0123' }
            ];
            const testMatchNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                { type: '0abc', another: '0123' }
            ];
            it('returns true when both nodes are the same', () => {
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('returns true even when a node of testMatchNodes contains extra prop', () => {
                testMatchNodes[0].extraMatchNodeProp = 'extra-ed';
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('returns false when a node of nodes contains extra prop', () => {
                testNodes[0].extraNodeProp = 'extra-ed';
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            it('returns false when testNode length exceeds matchNode and first half up to exceeding length matches', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: '0abc', another2: '01232' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            it('returns false when matchNode length exceeds testNode and first half up to exceeding length matches', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: '0abc', another2: '01232' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
        });
        describe('placeholder identifiers and edge cases', () => {
            let testNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                { type: 'extraed1', another: 'another1' },
                { type: 'extraed2', another2: 'another2' },
                { type: '0abc', another: '0123' }
            ];
            let testMatchNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                { type: '0abc', another: '0123' }
            ];
            it('initially does not work without placeholder', () => {
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            const placeholder = {
                type: 'ExpressionStatement',
                expression: {
                    type: 'Identifier',
                    name: 'PLACEHOLDER'
                }
            };
            it('works with a placeholder in the middle', () => {
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    cloneDeep(placeholder),
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('works with a placeholder in the beginning', () => {
                testNodes = [
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                testMatchNodes = [
                    cloneDeep(placeholder),
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('works with a placeholder in the end', () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    cloneDeep(placeholder)
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('works with a placeholder in the end matching nothing', () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    cloneDeep(placeholder)
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            const placeholder2 = {
                type: 'Identifier',
                name: 'PLACEHOLDER_2'
            };
            it('works with PLACEHOLDER_2 matching exactly twice in the middle', () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: '0abc', another: '0123' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    cloneDeep(placeholder2),
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            it('works with PLACEHOLDER_2 matching exactly twice in the end', () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    cloneDeep(placeholder2)
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
            });
            const placeholder1 = {
                type: 'Identifier',
                name: 'PLACEHOLDER_1'
            };
            it("doesn't work with PLACEHOLDER_1 in the end", () => {
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    cloneDeep(placeholder1)
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            it("doesn't work with PLACEHOLDER_1 in the middle", () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: '0abc', another: '0123' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    cloneDeep(placeholder1),
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            const placeholder3 = {
                type: 'Identifier',
                name: 'PLACEHOLDER_3'
            };
            it("doesn't work with PLACEHOLDER_3 in the end", () => {
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    cloneDeep(placeholder3)
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            it("doesn't work with PLACEHOLDER_3 in the middle", () => {
                testNodes = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: '0abc', another: '0123' }
                ];
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    cloneDeep(placeholder3),
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
            });
            it('throws an error given erroneous PLACEHOLDER_notanumber format', () => {
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER_notanumber'
                    },
                    { type: '0abc', another: '0123' }
                ];
                expect(() => transformer['nodesMatch'](testNodes, testMatchNodes)).toThrowError(
                    'placeholder identifier must match format: PLACEHOLDER_numberhere but instead received PLACEHOLDER_notanumber'
                );
            });
            it('throws an error given less or equal to 0. PLACEHOLDER_0 and PLACEHOLDER_-1', () => {
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER_0'
                    },
                    { type: '0abc', another: '0123' }
                ];
                expect(() => transformer['nodesMatch'](testNodes, testMatchNodes)).toThrowError(
                    'placeholder number must be greater than 0, but instead got PLACEHOLDER_0'
                );
                testMatchNodes = [
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER_-1'
                    },
                    { type: '0abc', another: '0123' }
                ];
                expect(() => transformer['nodesMatch'](testNodes, testMatchNodes)).toThrowError(
                    'placeholder number must be greater than 0, but instead got PLACEHOLDER_-1'
                );
            });
        });
        describe('placeholder placeholderItems temporary store and edge cases', () => {
            it('stores middle placeholder correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'Identifier', name: 'PLACEHOLDER' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' }
                        ]
                    },
                    { type: '0abc', another: '0123' }
                ]);
            });
            it('stores beginning placeholder correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'Identifier', name: 'PLACEHOLDER' },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' }
                        ]
                    },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ]);
            });
            it('stores end placeholder correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'extraed3', another3: 'another3' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'Identifier', name: 'PLACEHOLDER' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' },
                            { type: 'extraed3', another3: 'another3' }
                        ]
                    }
                ]);
            });
            it('stores end placeholder with ExpressionStatement correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'extraed3', another3: 'another3' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'ExpressionStatement', expression: { type: 'Identifier', name: 'PLACEHOLDER' } }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    {
                        type: 'ExpressionStatement',
                        expression: { type: 'Identifier', name: 'PLACEHOLDER' },
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' },
                            { type: 'extraed3', another3: 'another3' }
                        ]
                    }
                ]);
            });
            it('stores end PLACEHOLDER_3 correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'extraed3', another3: 'another3' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'Identifier', name: 'PLACEHOLDER_3' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER_3',
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' },
                            { type: 'extraed3', another3: 'another3' }
                        ]
                    }
                ]);
            });
            it('stores middle PLACEHOLDER_3 correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'extraed3', another3: 'another3' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'Identifier', name: 'PLACEHOLDER_3' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER_3',
                        placeholderItems: [
                            { type: 'extraed1', another: 'another1' },
                            { type: 'extraed2', another2: 'another2' },
                            { type: 'extraed3', another3: 'another3' }
                        ]
                    },
                    { type: '0abc', another: '0123' }
                ]);
            });
            it('stores empty PLACEHOLDER at beginning correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'Identifier', name: 'PLACEHOLDER' },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: []
                    },
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ]);
            });
            it('stores empty PLACEHOLDER at end correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    { type: 'Identifier', name: 'PLACEHOLDER' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: []
                    }
                ]);
            });
            it('stores empty PLACEHOLDER at middle correctly', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'Identifier', name: 'PLACEHOLDER' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(true);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER',
                        placeholderItems: []
                    },
                    { type: '0abc', another: '0123' }
                ]);
            });
            it('cleans up previous placeholder items upon mismatch', () => {
                const testNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'extraed1', another: 'another1' },
                    { type: 'extraed2', another2: 'another2' },
                    { type: 'extraed3', another3: 'another3' },
                    { type: '0abc', another: '0123' }
                ];
                const testMatchNodes: ASTTree[] = [
                    { type: 'abc', another: '123' },
                    { type: 'Identifier', name: 'PLACEHOLDER_1' },
                    { type: 'Identifier', name: 'PLACEHOLDER_1' },
                    { type: '0abc', another: '0123' }
                ];
                expect(transformer['nodesMatch'](testNodes, testMatchNodes)).toBe(false);
                expect(testMatchNodes).toStrictEqual([
                    { type: 'abc', another: '123' },
                    { type: 'Identifier', name: 'PLACEHOLDER_1' },
                    { type: 'Identifier', name: 'PLACEHOLDER_1' },
                    { type: '0abc', another: '0123' }
                ]);
            });
        });
    });
    describe('changeIdentifiersBack method', () => {
        const testNode: ASTTree = { type: 'abc', left: { type: 'Identifier', name: 'aUniqueName' } };
        const testMatchNode: ASTTree = { type: 'abc', left: { type: 'Identifier', name: 'GENERAL_somevar' } };

        it("should change all the inner objects' generalized identifiers back", () => {
            // save generalized variable to memory first
            expect(transformer['nodeMatch'](testNode, testMatchNode)).toBe(true);

            transformer['changeIdentifiersBack'](testMatchNode);
            expect(testMatchNode).toStrictEqual({ type: 'abc', left: { type: 'Identifier', name: 'aUniqueName' } });
        });
    });
    describe('transferPlaceholders method', () => {
        it('should transfer placeholders as expected and clean up before ast template afterwards', () => {
            const templateBeforeNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                {
                    type: 'Identifier',
                    name: 'PLACEHOLDER',
                    placeholderItems: [
                        { type: 'extraed1', another: 'another1' },
                        { type: 'extraed2', another2: 'another2' }
                    ]
                },
                { type: '0abc', another: '0123' }
            ];
            const templateAfterNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                { type: '0abc', another: '0123' },
                { type: 'ExpressionStatement', expression: { type: 'Identifier', name: 'PLACEHOLDER' } }
            ];

            transformer['transferPlaceholders'](templateBeforeNodes, templateAfterNodes);

            // check clean up
            expect(templateBeforeNodes).toStrictEqual([
                { type: 'abc', another: '123' },
                {
                    type: 'Identifier',
                    name: 'PLACEHOLDER'
                },
                { type: '0abc', another: '0123' }
            ]);

            // check successful transfer
            expect(templateAfterNodes).toStrictEqual([
                { type: 'abc', another: '123' },
                { type: '0abc', another: '0123' },
                {
                    type: 'ExpressionStatement',
                    expression: { type: 'Identifier', name: 'PLACEHOLDER' },
                    placeholderItems: [
                        { type: 'extraed1', another: 'another1' },
                        { type: 'extraed2', another2: 'another2' }
                    ]
                }
            ]);
        });
    });
    describe('expandedPlaceholdersLength method', () => {
        it('counts correctly', () => {
            expect(
                transformer['expandedPlaceholdersLength']([
                    { type: 'a' },
                    { type: 'b' },
                    { type: 'Identifier', name: 'PLACEHOLDER', placeholderItems: [{ type: 'a' }, { type: 'b' }] },
                    { type: 'c' },
                    { type: 'Identifier', name: 'PLACEHOLDER', placeholderItems: { type: 'singular' } },
                    { type: 'lastnode' }
                ])
            ).toBe(7);
        });
    });
    describe('reversePlaceholders method', () => {
        it('should work with singular placeholderItems', () => {
            const testNode: ASTTree = {
                type: 'Identifier',
                name: 'PLACEHOLDER',
                placeholderItems: { type: 'originalNode', stuff: 'here' }
            };
            transformer['reversePlaceholders'](testNode);
            expect(testNode).toStrictEqual({ type: 'originalNode', stuff: 'here' });
        });
        it('should work with multi placeholderItems', () => {
            const testNodes: ASTTree[] = [
                { type: 'a' },
                {
                    type: 'Identifier',
                    name: 'PLACEHOLDER',
                    placeholderItems: [{ type: 'someothernode' }, { type: 'morenodes' }]
                },
                {
                    type: 'moreinside',
                    inside: { type: 'Identifier', name: 'PLACEHOLDER', placeholderItems: { type: 'singularreplace' } },
                    insideMulti: [
                        {
                            type: 'Identifier',
                            name: 'PLACEHOLDER',
                            placeholderItems: [{ type: 'more1' }, { type: 'more2' }]
                        }
                    ]
                },
                { type: 'c' }
            ];
            transformer['reversePlaceholders'](testNodes);
            expect(testNodes).toStrictEqual([
                { type: 'a' },
                { type: 'someothernode' },
                { type: 'morenodes' },
                {
                    type: 'moreinside',
                    inside: { type: 'singularreplace' },
                    insideMulti: [{ type: 'more1' }, { type: 'more2' }]
                },
                { type: 'c' }
            ]);
        });
        it('throws an error if placeholderItems is non-singular in a singular node', () => {
            expect(() =>
                transformer['reversePlaceholders']({
                    type: 'Identifier',
                    name: 'PLACEHOLDER',
                    placeholderItems: [{ type: 'woahthere' }]
                })
            ).toThrowError('unexpected placeholderItems to be non-singular');
        });
    });
    describe('updateNode method', () => {
        it('should update testNode with templateAfterNode as a reference without touching templateAfterNode', () => {
            const testNode: ASTTree = {
                type: 'abc',
                start: 234,
                left: { type: 'Identifier', name: 'aUniqueName' }
            };
            const testMatchNode: ASTTree = { type: 'abc', left: { type: 'Identifier', name: 'GENERAL_somevar' } };
            const templateAfterNode: ASTTree = {
                type: 'abc',
                left: { type: 'Identifier', name: 'GENERAL_somevar' },
                right: { type: 'Identifier', name: 'GENERAL_somevar' },
                body: { type: 'Identifier', name: 'GENERAL_unknownvar' }
            };

            // save generalized variable to memory first
            expect(transformer['nodeMatch'](testNode, testMatchNode)).toBe(true);

            const testChangeAfterNode = cloneDeep(templateAfterNode);
            transformer['updateNode'](testNode, testChangeAfterNode);

            expect(testChangeAfterNode).toStrictEqual(templateAfterNode);
            expect(testNode).toStrictEqual({
                type: 'abc',
                start: 234,
                left: { type: 'Identifier', name: 'aUniqueName' },
                right: { type: 'Identifier', name: 'aUniqueName' },
                body: { type: 'Identifier', name: 'GENERAL_unknownvar' }
            });
        });
        it('should take care of placeholders correctly and cleans up afterwards', () => {
            const testNode: ASTTree = {
                type: 'dontmatterwhatthisis',
                like: 'really'
            };
            const templateAfterNode: ASTTree = {
                type: 'Identifier',
                name: 'PLACEHOLDER',
                placeholderItems: { type: 'originalNode', with: 'stuffInIt' }
            };

            transformer['updateNode'](testNode, templateAfterNode);

            expect(testNode).toStrictEqual({ type: 'originalNode', with: 'stuffInIt' });
            expect(templateAfterNode).toStrictEqual({ type: 'Identifier', name: 'PLACEHOLDER' });
        });
    });
    describe('referenceNodesToModifiedOriginal method', () => {
        it('expands placeholderItems correctly and cleans it up', () => {
            const templateAfterNodes: ASTTree[] = [
                { type: 'abc', another: '123' },
                {
                    type: 'Identifier',
                    name: 'PLACEHOLDER',
                    placeholderItems: [
                        { type: 'extraed1', another: 'another1' },
                        { type: 'extraed2', another2: 'another2' }
                    ]
                },
                { type: '0abc', another: '0123' }
            ];

            expect(transformer['referenceNodesToModifiedOriginal'](templateAfterNodes)).toStrictEqual([
                { type: 'abc', another: '123' },
                { type: 'extraed1', another: 'another1' },
                { type: 'extraed2', another2: 'another2' },
                { type: '0abc', another: '0123' }
            ]);
            // check cleanup
            expect(templateAfterNodes).toStrictEqual([
                { type: 'abc', another: '123' },
                {
                    type: 'Identifier',
                    name: 'PLACEHOLDER'
                },
                { type: '0abc', another: '0123' }
            ]);
        });
    });
    // // woohoo! finally. last step of the entire process
    describe('transform', () => {
        describe('transforming single template-before-after ast', () => {
            it('transforms correctly and retains the integrity of template-before-after ast', () => {
                const originalBeforeAst: ASTTree[] = [
                    {
                        type: 'abc',
                        another: '123',
                        inner: { type: 'Identifier', name: 'GENERAL_var' },
                        someUnknown: {
                            type: 'Identifier',
                            name: 'PLACEHOLDER'
                        }
                    }
                ];
                const originalAfterAst: ASTTree[] = [
                    {
                        type: 'abcd',
                        another: 'completelyDifferent',
                        inner: { type: 'inElement', evenMoreInner: { type: 'Identifier', name: 'GENERAL_var' } },
                        someUnknown: {
                            type: 'weperhapscareabout',
                            moreunknown: {
                                type: 'Identifier',
                                name: 'PLACEHOLDER'
                            }
                        }
                    }
                ];
                transformer.templateBeforeAst = cloneDeep(originalBeforeAst);
                transformer.templateAfterAst = cloneDeep(originalAfterAst);
                const toBeTransformed: ASTTree = {
                    type: 'abc',
                    another: '123',
                    inner: { type: 'Identifier', name: 'uniqueVariable' },
                    someUnknown: {
                        type: 'thatwedontcareabout'
                    }
                };

                expect(transformer.transform(toBeTransformed)).toBe(1);
                expect(toBeTransformed).toStrictEqual({
                    type: 'abcd',
                    another: 'completelyDifferent',
                    inner: { type: 'inElement', evenMoreInner: { type: 'Identifier', name: 'uniqueVariable' } },
                    someUnknown: {
                        type: 'weperhapscareabout',
                        moreunknown: {
                            type: 'thatwedontcareabout'
                        }
                    }
                });

                // check template ast integrity
                expect(transformer.templateBeforeAst).toStrictEqual(originalBeforeAst);
                expect(transformer.templateAfterAst).toStrictEqual(originalAfterAst);
            });
        });
        describe('transforming multi template-before-after ast', () => {
            it('transforms correctly and retains the integrity of template-before-after ast', () => {
                const originalBeforeAst: ASTTree[] = [
                    {
                        type: 'abc',
                        another: '123'
                    },
                    {
                        type: 'Identifier',
                        name: 'PLACEHOLDER'
                    },
                    {
                        type: 'end',
                        the: 'ending'
                    }
                ];
                const originalAfterAst: ASTTree[] = [
                    {
                        type: 'abcd',
                        something: 'else'
                    },
                    {
                        type: 'placedIt',
                        inHere: [
                            {
                                type: 'Identifier',
                                name: 'PLACEHOLDER'
                            }
                        ]
                    }
                ];
                transformer.templateBeforeAst = cloneDeep(originalBeforeAst);
                transformer.templateAfterAst = cloneDeep(originalAfterAst);
                const toBeTransformed: ASTTree[] = [
                    {
                        type: 'abc',
                        another: '123'
                    },
                    {
                        type: 'uniquestuff',
                        name: 'here'
                    },
                    {
                        type: 'uniquestuff2',
                        name: 'here2'
                    },
                    {
                        type: 'end',
                        the: 'ending'
                    }
                ];

                expect(transformer.transform(toBeTransformed)).toBe(1);
                expect(toBeTransformed).toStrictEqual([
                    {
                        type: 'abcd',
                        something: 'else'
                    },
                    {
                        type: 'placedIt',
                        inHere: [
                            {
                                type: 'uniquestuff',
                                name: 'here'
                            },
                            {
                                type: 'uniquestuff2',
                                name: 'here2'
                            }
                        ]
                    }
                ]);

                // check template ast integrity
                expect(transformer.templateBeforeAst).toStrictEqual(originalBeforeAst);
                expect(transformer.templateAfterAst).toStrictEqual(originalAfterAst);
            });
        });
    });
});
