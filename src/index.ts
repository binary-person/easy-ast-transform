/*
to any future readers:
I'm sorry for the code mess. I did not plan this through, since
I thought it was going to be a very simple module. As a result, the code
is a mess, and I've tried my best to comment, and separate methods to highlight
what's going on. I may rewrite the entire thing, but given the busy schedule a student
nearing the entry of college suffers from, it's highly unlikely that that's going to happen.
*/

import cloneDeep = require('clone-deep');

interface ASTTree {
    [prop: string]: any;
    type: string;
    body?: ASTTree | ASTTree[];
    name?: string;
    expression?: ASTTree;
}

// utils
const isASTNode = (checkNode?: ASTTree): boolean => {
    return !!checkNode && typeof checkNode.type === 'string';
};
const getIdentifier = (node: ASTTree): string | false => {
    if (node.type === 'Identifier') return node.name as string;
    if (node.type === 'ExpressionStatement' && node.expression?.type === 'Identifier')
        return node.expression.name as string;
    return false;
};
const traverse = (node: ASTTree | ASTTree[], callback: (node: ASTTree) => void | false): void => {
    if (Array.isArray(node)) {
        for (const eachNode of node) {
            traverse(eachNode, callback);
        }
        return;
    }
    if (!isASTNode(node)) return;
    if (callback(node) === false) return;
    for (const prop in node) {
        if (Array.isArray(node[prop])) {
            for (const nodeInArr of node[prop]) traverse(nodeInArr, callback);
        } else {
            traverse(node[prop], callback);
        }
    }
};

interface EasyAstTransformOptions {
    generalizedPrefix?: string;
    placeholder?: string;
    ignoreProperties?: string[];
}

const DefaultAstTransformOptions = {
    generalizedPrefix: 'GENERAL_',
    placeholder: 'PLACEHOLDER',
    // aisde from start and end, the rest are from recast
    ignoreProperties: ['start', 'end', 'comments', 'tokens', 'loc', 'original']
};

class EasyAstTransform {
    templateBeforeAst: ASTTree[];
    templateAfterAst: ASTTree[];
    options: typeof DefaultAstTransformOptions;

    // used only for nodeMatch and nodesMatch. caveat is reserved obj props are not supported
    // { generalIdentifierName: targetMatchIdentifierName }
    private generalIdAliases: { [prop: string]: string } = Object.create(null);

    constructor(templateBeforeAst: ASTTree[], templateAfterAst: ASTTree[], options: EasyAstTransformOptions = {}) {
        this.templateBeforeAst = templateBeforeAst;
        this.templateAfterAst = templateAfterAst;
        this.options = {
            generalizedPrefix: options.generalizedPrefix || DefaultAstTransformOptions.generalizedPrefix,
            placeholder: options.placeholder || DefaultAstTransformOptions.placeholder,
            ignoreProperties: options.ignoreProperties || DefaultAstTransformOptions.ignoreProperties
        };
    }

    private reverseLookupGeneralIdAliases(value: string): string | undefined {
        for (const prop in this.generalIdAliases) {
            if (value === this.generalIdAliases[prop]) {
                return prop;
            }
        }
        return;
    }
    private parsePlaceholderNum(placeholderIdentifier: string): number | null {
        if (this.options.placeholder !== placeholderIdentifier) {
            // must be formatted as PLACEHOLDER_1
            const split = placeholderIdentifier.split('_');
            const parsedNum = parseInt(split[1]);
            if (split.length !== 2 || isNaN(parsedNum)) {
                throw new TypeError(
                    `placeholder identifier must match format: ${this.options.placeholder}_numberhere but instead received ${placeholderIdentifier}`
                );
            }
            if (parsedNum <= 0) {
                throw new TypeError(
                    `placeholder number must be greater than 0, but instead got ${placeholderIdentifier}`
                );
            }
            return parsedNum;
        } else {
            return null;
        }
    }
    /**
     * matching two nodes and can be used with traversal of all props of a node
     */
    private nodeMatch(node: ASTTree, matchNode: ASTTree, isFirstTime = true): boolean {
        // cleanup generalIdAliases if it is not called by nodeMatch or nodesMatch
        if (isFirstTime) {
            this.generalIdAliases = Object.create(null);
        }

        if (!isASTNode(node) || !isASTNode(matchNode)) {
            // we do not expect any objects in any of the props
            // other than nodes
            const checkObj = (obj: any): boolean => typeof obj === 'object' && obj !== null;
            if (checkObj(node) && checkObj(matchNode)) {
                throw new TypeError(
                    'Unexpected node or matchNode to be an object while not being an AST node (you may need to specify certain props in ignoreProperties): \n' +
                        JSON.stringify(checkObj(node) ? node : matchNode, null, 4)
                );
            }
            return node === matchNode;
        }

        // check if matchNode is a placeholder
        const matchIdentifier = getIdentifier(matchNode);
        if (matchIdentifier && matchIdentifier.startsWith(this.options.placeholder)) {
            const count = this.parsePlaceholderNum(matchIdentifier);
            if (!count || count === 1) {
                // flag this by not putting an array so later code will know and have this placeholder replace itself
                matchNode.placeholderItems = node;
                return true;
            } else {
                return false;
            }
        }

        if (node.type !== matchNode.type) return false;
        if (matchNode.type === 'Identifier') {
            // both must be identifiers
            if (matchNode.name?.startsWith(this.options.generalizedPrefix)) {
                if (!this.generalIdAliases[matchNode.name]) {
                    // make sure target alias isn't already assigned
                    if (this.reverseLookupGeneralIdAliases(node.name as string)) {
                        // if it is already assigned, then the identifiers (or the nodes) are not the same
                        return false;
                    }
                    this.generalIdAliases[matchNode.name] = node.name as string;
                }
                return this.generalIdAliases[matchNode.name] === node.name;
            } else {
                return matchNode.name === node.name;
            }
        }
        for (const prop in node) {
            if (this.options.ignoreProperties.includes(prop)) continue;
            if (Array.isArray(node[prop])) {
                if (!Array.isArray(matchNode[prop])) return false;
                if (!this.nodesMatch(node[prop], matchNode[prop], false)) return false;
            } else {
                if (!this.nodeMatch(node[prop], matchNode[prop], false)) return false;
            }
        }
        return true;
    }
    /**
     * matching arrays of nodes
     */
    private nodesMatch(nodes: ASTTree[], matchNodes: ASTTree[], isFirstTime = true): boolean {
        // cleanup generalIdAliases if it is not called by nodeMatch or nodesMatch (copy paste from nodeMatch)
        if (isFirstTime) {
            this.generalIdAliases = Object.create(null);
        }

        const cleanupReturnFalse = (): false => {
            for (const node of matchNodes) {
                delete node.placeholderItems;
            }
            return false;
        };
        let i = 0,
            j = 0,
            previousPlaceholder = false;
        for (; i < nodes.length; i++, j++) {
            // i is for nodes. j is for matchNodes

            // we traversed passed the matchNodes length which means they don't match unless previousPlaceholder === true
            if (j >= matchNodes.length) {
                if (previousPlaceholder) {
                    // make sure we push the rest of the nodes in
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    matchNodes[j - 1].placeholderItems.push(...nodes.slice(i));
                    return true;
                } else {
                    return cleanupReturnFalse();
                }
            }

            const matchIdentifier = getIdentifier(matchNodes[j]);
            if (matchIdentifier && matchIdentifier.startsWith(this.options.placeholder)) {
                const count: number | null = this.parsePlaceholderNum(matchIdentifier); // null means match as needed
                if (count !== null) {
                    // fast forward by count steps
                    // the following is for later in updateNodes so we don't need to do placeholder calculation again
                    const oldI = i;
                    const savePlaceholder = () => {
                        matchNodes[j].placeholderItems = nodes.slice(oldI, i + 1);
                    };
                    i += count - 1; // reason for the -1, is that at the end of the loop, it will also increment
                    // make sure the increment is smaller or neatly matches nodes.length
                    if (i + 1 > nodes.length) return cleanupReturnFalse();
                    if (i + 1 === nodes.length) {
                        // in this case, we also need to check if we traversed through all our matchNodes
                        if (j + 1 === matchNodes.length) {
                            savePlaceholder();
                            return true;
                        } else {
                            return cleanupReturnFalse();
                        }
                    }
                    savePlaceholder();
                } else {
                    // there is an edge case where the placeholder matches nothing and the next
                    // nodes do match, which should result in placeholderItems = []
                    if (matchNodes[j + 1] && this.nodeMatch(nodes[i], matchNodes[j + 1], false)) {
                        matchNodes[j].placeholderItems = [];
                        // step back and redo nodes[i] but with matchNodes[j + 1]
                        i--;
                        continue;
                    }

                    // set flag to tell the next iteration to not return false if the nodes do not match
                    previousPlaceholder = true;
                    if (matchNodes[j].placeholderItems)
                        throw new Error('unexpected already existing property placeholderItems');
                    matchNodes[j].placeholderItems = [nodes[i]];
                }
            } else {
                if (!this.nodeMatch(nodes[i], matchNodes[j], false)) {
                    if (!previousPlaceholder) return cleanupReturnFalse();
                    j--; // prevent from incrementing matchNodes since we're still on the matchNode next to the placeholder
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    matchNodes[j].placeholderItems.push(nodes[i]); // this is safe because the previous element is a placeholder, which we already set
                } else {
                    previousPlaceholder = false; // reset flag and move on
                }
            }
        }
        // edge case where we haven't traversed through all of our matchNodes yet
        if (j < matchNodes.length) {
            // check if last element is a placeholder
            const lastMatchIndex = matchNodes.length - 1;
            const matchIdentifier = getIdentifier(matchNodes[lastMatchIndex]);
            if (matchIdentifier && matchIdentifier.startsWith(this.options.placeholder)) {
                const count = this.parsePlaceholderNum(matchIdentifier);
                if (count === null) {
                    matchNodes[lastMatchIndex].placeholderItems = [];
                    return true;
                } else {
                    return cleanupReturnFalse();
                }
            }
            // if it's not a placeholder, then it's a mismatch
            return cleanupReturnFalse();
        }
        return true;
    }
    /**
     * to be used only by updateNode and referenceNodesToModifiedOriginal
     *
     * @param node - template after match node
     */
    private changeIdentifiersBack(node: ASTTree | ASTTree[]): void {
        if (Array.isArray(node)) {
            for (const eachNode of node) this.changeIdentifiersBack(eachNode);
            return;
        }
        if (!isASTNode(node)) return;
        if (node.type === 'Identifier') {
            const aliased = this.generalIdAliases[node.name as string];
            if (aliased) node.name = aliased;
            return;
        }
        for (const prop in node) {
            if (Array.isArray(node[prop])) {
                for (const eachNode of node[prop]) {
                    this.changeIdentifiersBack(eachNode);
                }
            } else {
                this.changeIdentifiersBack(node[prop]);
            }
        }
    }
    /**
     * transfers placeholderItems in template before ast to placeholders after ast
     * and cleans up placeholderItems in before ast.
     * To be used only by transform
     */
    private transferPlaceholders(beforeAsts: ASTTree[], afterAsts: ASTTree[]): void {
        const beforeAstPlaceholderStack: ASTTree[] = []; // contains all placeholderItems
        const afterAstPlaceholderStack: ASTTree[] = []; // contains objects of placeholders so we can directly modify them
        const traversePlaceholders = (node: ASTTree | ASTTree[], callback: (placeholderNode: ASTTree) => void) => {
            traverse(node, (traversedNode) => {
                const testIdentifier = getIdentifier(traversedNode);
                if (testIdentifier && testIdentifier.startsWith(this.options.placeholder)) {
                    callback(traversedNode);
                    return false;
                }
            });
        };
        traversePlaceholders(beforeAsts, (placeholderNode) => {
            if (!placeholderNode.placeholderItems) {
                throw new Error('unxpected matched node to not contain placeholderItems');
            }
            beforeAstPlaceholderStack.push(placeholderNode);
        });
        traversePlaceholders(afterAsts, (placeholderNode) => {
            if (placeholderNode.placeholderItems) {
                throw new Error('unxpected template after node to already contain placeholderItems');
            }
            afterAstPlaceholderStack.push(placeholderNode);
        });
        if (beforeAstPlaceholderStack.length !== afterAstPlaceholderStack.length) {
            throw new Error('before ast template and after ast template must contain same number of placeholders');
        }
        for (let i = 0; i < beforeAstPlaceholderStack.length; i++) {
            const beforeName = getIdentifier(beforeAstPlaceholderStack[i]);
            const afterName = getIdentifier(afterAstPlaceholderStack[i]);
            if (beforeName !== afterName) {
                throw new Error(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `before after template ast's placeholders must match in the order the ast parses it (from top to bottom). ${beforeName} !== ${afterName}`
                );
            }
            afterAstPlaceholderStack[i].placeholderItems = beforeAstPlaceholderStack[i].placeholderItems;
            delete beforeAstPlaceholderStack[i].placeholderItems;
        }
    }
    /**
     * used for counting how many to splice in the processed node. to be only used by transform
     */
    private expandedPlaceholdersLength(nodes: ASTTree[]): number {
        let count = 0;
        for (const node of nodes) {
            if (node.placeholderItems && Array.isArray(node.placeholderItems)) {
                count += node.placeholderItems.length;
            } else {
                count++;
            }
        }
        return count;
    }
    /**
     * this inlines placeholderItems to the placeholder itself, or an array of nodes with the placeholder
     */
    private reversePlaceholders(nodes: ASTTree[] | ASTTree): void {
        if (Array.isArray(nodes)) {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].placeholderItems) {
                    const placeholderItems = nodes[i].placeholderItems as ASTTree[] | ASTTree;
                    if (Array.isArray(placeholderItems)) {
                        nodes.splice(i, 1, ...placeholderItems);
                        continue;
                    }
                }
                this.reversePlaceholders(nodes[i]);
            }
        } else {
            if (!isASTNode(nodes)) return;
            if (nodes.placeholderItems) {
                const placeholderItems = nodes.placeholderItems as ASTTree[] | ASTTree;
                if (Array.isArray(placeholderItems))
                    throw new Error(
                        'unexpected placeholderItems to be non-singular. did you place a placeholder in an area where it is supposed to be within a body/array of nodes?'
                    );
                for (const prop in nodes) {
                    delete nodes[prop];
                }
                for (const prop in placeholderItems) {
                    nodes[prop] = placeholderItems[prop];
                }
                return;
            }
            for (const prop in nodes) {
                this.reversePlaceholders(nodes[prop]);
            }
        }
    }
    /**
     * to be used only by transform
     *
     * @param toBeUpdatedNode
     * @param referenceNode - template after node
     */
    private updateNode(toBeUpdatedNode: ASTTree, referenceNode: ASTTree): void {
        // delete all the props
        for (const prop in toBeUpdatedNode) {
            if (this.options.ignoreProperties.includes(prop)) continue;
            delete toBeUpdatedNode[prop];
        }

        const modifiedReferenceNode = cloneDeep(referenceNode);

        this.reversePlaceholders(modifiedReferenceNode);

        // change all aliased general identifiers back to their old ones
        this.changeIdentifiersBack(modifiedReferenceNode);

        // add in all the rest
        for (const prop in modifiedReferenceNode) {
            if (this.options.ignoreProperties.includes(prop)) continue;
            toBeUpdatedNode[prop] = modifiedReferenceNode[prop];
            if (isASTNode(toBeUpdatedNode[prop])) {
            }
        }

        // clean up original placeholder nodes
        traverse(referenceNode, (node) => {
            delete node.placeholderItems;
        });
    }
    /**
     * this is to be called after nodeMatch or nodesMatch because it
     * depends on the modified state of generalIdAliases by those methods.
     * This cleans up placeholderItems also.
     * (to be only used by transform)
     *
     * this is essentially updateNode but with arrays. Due to algorithmic limitations,
     * we are unable to retain ignoreProperties for this step
     *
     * @param toBeUpdatedNodes
     * @param referenceNodes - after ast template
     */
    private referenceNodesToModifiedOriginal(referenceNodes: ASTTree[]): ASTTree[] {
        // we assume first element of both nodes are the same so we work from index 0

        // we need to do two things: expand placeholders and change identifiers back

        const modifiedReferenceNodes = cloneDeep(referenceNodes);

        this.reversePlaceholders(modifiedReferenceNodes);

        traverse(referenceNodes, (node) => {
            delete node.placeholderItems;
        });

        return modifiedReferenceNodes;
    }
    /**
     * @returns number of occurrences replaced
     */
    public transform(toBeTransformed: ASTTree | ASTTree[]): number {
        let count = 0;
        if (!Array.isArray(toBeTransformed) && !isASTNode(toBeTransformed)) {
            return 0;
        }
        // there are two kinds of replacing we need to be concerned about:
        // single node and array of nodes.
        // the following is for single node
        if (this.templateBeforeAst.length === 1 && this.templateAfterAst.length === 1) {
            traverse(toBeTransformed, (node) => {
                if (this.nodeMatch(node, this.templateBeforeAst[0])) {
                    this.transferPlaceholders(this.templateBeforeAst, this.templateAfterAst);
                    this.updateNode(node, this.templateAfterAst[0]);
                    count++;
                }
            });
        } else {
            // the following is for array of nodes, which is a bit more complicated.
            // essentailly, we need to get all the node arrays and replace them if they match
            if (Array.isArray(toBeTransformed)) {
                for (let i = 0; i < toBeTransformed.length; i++) {
                    if (this.nodesMatch(toBeTransformed.slice(i), this.templateBeforeAst)) {
                        const expandedCount = this.expandedPlaceholdersLength(this.templateBeforeAst);
                        this.transferPlaceholders(this.templateBeforeAst, this.templateAfterAst);
                        const updatedNodes = this.referenceNodesToModifiedOriginal(this.templateAfterAst);
                        toBeTransformed.splice(i, expandedCount, ...updatedNodes);
                        count++;
                    }
                }
            } else {
                for (const prop in toBeTransformed) {
                    count += this.transform(toBeTransformed[prop]);
                }
            }
        }

        return count;
    }
}

export = EasyAstTransform;
