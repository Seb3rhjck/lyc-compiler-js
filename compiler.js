import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createToken, Lexer, CstParser } from 'chevrotain';

// ==================== CONFIGURACIÓN INICIAL ====================
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==================== DEFINICIÓN DE TOKENS ====================

// Tokens básicos
const WhiteSpace = createToken({
    name: 'WhiteSpace',
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

const Comment = createToken({
    name: 'Comment',
    pattern: /\/\/.*|\/\*[\s\S]*?\*\//,
    group: Lexer.SKIPPED
});

const NumberLiteral = createToken({ 
    name: 'NumberLiteral', 
    pattern: /-?\d*\.?\d+/
});

const Percentage = createToken({
    name: 'Percentage',
    pattern: /\d+%/
});

const CssUnit = createToken({
    name: 'CssUnit',
    pattern: /(px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|turn|rad|grad)/
});

const CssValueWithUnit = createToken({
    name: 'CssValueWithUnit',
    pattern: /-?\d*\.?\d+(px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|turn|rad|grad)\b/,
    longer_alt: NumberLiteral
});

// Tokens para colores y selectores
const HexColor = createToken({
    name: 'HexColor',
    pattern: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/
});

const RgbaFunction = createToken({
    name: 'RgbaFunction',
    pattern: /rgba?\(/
});

const ClassSelector = createToken({
    name: 'ClassSelector',
    pattern: /\.[a-zA-Z_][a-zA-Z0-9_-]*/
});

const IdSelector = createToken({
    name: 'IdSelector',
    pattern: /#[a-zA-Z_][a-zA-Z0-9_-]*/
});

// Tokens para reglas @
const AtKeyword = createToken({ name: 'AtKeyword', pattern: Lexer.NA });
const MixinKeyword = createToken({ 
    name: 'MixinKeyword', 
    pattern: /@mixin\b/,
    categories: [AtKeyword]
});
const IncludeKeyword = createToken({ 
    name: 'IncludeKeyword', 
    pattern: /@include\b/,
    categories: [AtKeyword]
});
const ExtendKeyword = createToken({ 
    name: 'ExtendKeyword', 
    pattern: /@extend\b/,
    categories: [AtKeyword]
});
const LayerKeyword = createToken({ 
    name: 'LayerKeyword', 
    pattern: /@layer\b/,
    categories: [AtKeyword]
});
const KeyframesKeyword = createToken({ 
    name: 'KeyframesKeyword', 
    pattern: /@keyframes\b/,
    categories: [AtKeyword]
});
const MediaKeyword = createToken({ 
    name: 'MediaKeyword', 
    pattern: /@media\b/,
    categories: [AtKeyword]
});

// Otros tokens
const Identifier = createToken({
    name: 'Identifier',
    pattern: /[a-zA-Z_][a-zA-Z0-9_-]*/
});

const StringLiteral = createToken({
    name: 'StringLiteral',
    pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/
});

const Variable = createToken({
    name: 'Variable',
    pattern: /--[a-zA-Z_][a-zA-Z0-9_-]*/
});

const Operator = createToken({
    name: 'Operator',
    pattern: /[+\-*/%]/
});

const FunctionToken = createToken({
    name: 'FunctionToken',
    pattern: /[a-zA-Z-]+\(/
});

// Tokens de puntuación
const OpenParen = createToken({ name: 'OpenParen', pattern: /\(/ });
const CloseParen = createToken({ name: 'CloseParen', pattern: /\)/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const OpenBrace = createToken({ name: 'OpenBrace', pattern: /\{/ });
const CloseBrace = createToken({ name: 'CloseBrace', pattern: /\}/ });
const Colon = createToken({ name: 'Colon', pattern: /:/ });
const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
const Dot = createToken({ name: 'Dot', pattern: /\./ });
const Important = createToken({ name: 'Important', pattern: /!important\b/ });

// Orden de tokens (más específicos primero)
const allTokens = [
    WhiteSpace,
    Comment,
    CssValueWithUnit,
    CssUnit,
    HexColor,
    RgbaFunction,
    ClassSelector,
    IdSelector,
    MixinKeyword,
    IncludeKeyword,
    ExtendKeyword,
    LayerKeyword,
    KeyframesKeyword,
    MediaKeyword,
    Variable,
    FunctionToken,
    Important,
    NumberLiteral,
    Percentage,
    StringLiteral,
    Identifier,
    Operator,
    OpenParen,
    CloseParen,
    Comma,
    OpenBrace,
    CloseBrace,
    Colon,
    Semicolon,
    Dot
];

// Configuración del lexer
const lexer = new Lexer(allTokens, {
    positionTracking: "full",
    ensureOptimizations: true,
    errorMessageProvider: {
        createUnexpectedCharactersMessage: (fullText, startOffset, length, line, column) => {
            const char = fullText.substr(startOffset, 1);
            return `Carácter inesperado '${char}' en línea ${line}:${column}`;
        }
    }
});

// ==================== DEFINICIÓN DEL PARSER ====================
class LayerCSSParser extends CstParser {
    constructor() {
        super(allTokens, {
            recoveryEnabled: true,
            maxLookahead: 3
        });
        const $ = this;

        // Regla principal
        $.RULE('stylesheet', () => {
            $.MANY(() => {
                $.SUBRULE($.statement);
            });
        });

        // Declaraciones
        $.RULE('statement', () => {
            $.OR([
                { ALT: () => $.SUBRULE($.variableDeclaration) },
                { ALT: () => $.SUBRULE($.atRule) },
                { ALT: () => $.SUBRULE($.styleRule) },
                { ALT: () => $.CONSUME(Semicolon, { ERR_MSG: "Declaración inválida" }) }
            ]);
        });

        // Variables CSS
        $.RULE('variableDeclaration', () => {
            $.CONSUME(Variable);
            $.CONSUME(Colon);
            $.SUBRULE($.cssValue);
            $.CONSUME(Semicolon);
        });

        // Reglas @
        $.RULE('atRule', () => {
            $.OR([
                { GATE: () => $.LA(1).tokenType === MixinKeyword, ALT: () => $.SUBRULE($.mixinDeclaration) },
                { GATE: () => $.LA(1).tokenType === IncludeKeyword, ALT: () => $.SUBRULE($.includeStatement) },
                { GATE: () => $.LA(1).tokenType === ExtendKeyword, ALT: () => $.SUBRULE($.extendStatement) },
                { GATE: () => $.LA(1).tokenType === LayerKeyword, ALT: () => $.SUBRULE($.layerStatement) },
                { GATE: () => $.LA(1).tokenType === KeyframesKeyword, ALT: () => $.SUBRULE($.keyframesRule) },
                { GATE: () => $.LA(1).tokenType === MediaKeyword, ALT: () => $.SUBRULE($.mediaRule) }
            ]);
        });

        // Mixins
        $.RULE('mixinDeclaration', () => {
            $.CONSUME(MixinKeyword);
            $.CONSUME(Identifier);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.statement));
            $.CONSUME(CloseBrace);
        });

        // Includes
        $.RULE('includeStatement', () => {
            $.CONSUME(IncludeKeyword);
            $.CONSUME(Identifier);
            $.OPTION(() => {
                $.CONSUME(OpenParen);
                $.MANY_SEP({
                    SEP: Comma,
                    DEF: () => $.SUBRULE($.cssValue),
                });
                $.CONSUME(CloseParen);
            });
            $.CONSUME(Semicolon);
        });

        // Extends
        $.RULE('extendStatement', () => {
            $.CONSUME(ExtendKeyword);
            $.SUBRULE($.selector);
            $.CONSUME(Semicolon);
        });

        // Capas
        $.RULE('layerStatement', () => {
            $.CONSUME(LayerKeyword);
            $.OPTION(() => $.CONSUME(Identifier));
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.statement));
            $.CONSUME(CloseBrace);
        });

        // Keyframes
        $.RULE('keyframesRule', () => {
            $.CONSUME(KeyframesKeyword);
            $.CONSUME(Identifier);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.keyframeBlock));
            $.CONSUME(CloseBrace);
        });

        // Bloques de keyframes
        $.RULE('keyframeBlock', () => {
            $.OR([
                { ALT: () => $.CONSUME(Percentage) },
                { ALT: () => $.CONSUME(Identifier) }
            ]);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.property));
            $.CONSUME(CloseBrace);
        });

        // Media queries
        $.RULE('mediaRule', () => {
            $.CONSUME(MediaKeyword);
            $.SUBRULE($.mediaQuery);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.statement));
            $.CONSUME(CloseBrace);
        });

        // Media query conditions
        $.RULE('mediaQuery', () => {
            $.AT_LEAST_ONE(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Identifier) },
                    { ALT: () => $.CONSUME(NumberLiteral) },
                    { ALT: () => $.CONSUME(OpenParen) },
                    { ALT: () => $.CONSUME(CloseParen) },
                    { ALT: () => $.CONSUME(Colon) }
                ]);
            });
        });

        // Reglas de estilo
        $.RULE('styleRule', () => {
            $.OR([
                { ALT: () => $.SUBRULE($.standardRule) },
                { ALT: () => $.SUBRULE($.nestedRule) }
            ]);
        });

        // Reglas estándar
        $.RULE('standardRule', () => {
            $.SUBRULE($.selector);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.property));
            $.CONSUME(CloseBrace);
        });

        // Selectores
        $.RULE('selector', () => {
            $.AT_LEAST_ONE_SEP({
                SEP: Comma,
                DEF: () => $.SUBRULE($.singleSelector)
            });
        });

        // Selector individual
        $.RULE('singleSelector', () => {
            $.AT_LEAST_ONE(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Identifier) },
                    { ALT: () => $.CONSUME(ClassSelector) },
                    { ALT: () => $.CONSUME(IdSelector) },
                    { ALT: () => $.CONSUME(Variable) },
                    { ALT: () => $.CONSUME(OpenBrace) }
                ]);
            });
        });

        // Reglas anidadas
        $.RULE('nestedRule', () => {
            $.CONSUME(Identifier);
            $.CONSUME(Colon);
            $.SUBRULE($.cssValue);
            $.CONSUME(OpenBrace);
            $.MANY(() => $.SUBRULE($.property));
            $.CONSUME(CloseBrace);
        });

        // Propiedades CSS
        $.RULE('property', () => {
            $.CONSUME(Identifier);
            $.CONSUME(Colon);
            $.SUBRULE($.cssValue);
            $.OPTION(() => $.CONSUME(Important));
            $.CONSUME(Semicolon);
        });

        // Valores CSS
        $.RULE('cssValue', () => {
            $.OR([
                { ALT: () => $.SUBRULE($.operationValue) },
                { ALT: () => $.SUBRULE($.functionValue) },
                { ALT: () => $.SUBRULE($.atomicValue) },
                { ALT: () => $.SUBRULE($.listValue) }
            ]);
        });

        // Valores atómicos
        $.RULE('atomicValue', () => {
            $.OR([
                { ALT: () => $.CONSUME(StringLiteral) },
                { ALT: () => $.CONSUME(CssValueWithUnit) },
                { ALT: () => $.CONSUME(NumberLiteral) },
                { ALT: () => $.CONSUME(HexColor) },
                { ALT: () => $.CONSUME(Variable) },
                { ALT: () => $.CONSUME(Identifier) }
            ]);
        });

        // Listas de valores
        $.RULE('listValue', () => {
            $.AT_LEAST_ONE_SEP({
                SEP: WhiteSpace,
                DEF: () => $.SUBRULE($.atomicValue)
            });
        });

        // Funciones CSS
        $.RULE('functionValue', () => {
            $.OR([
                { ALT: () => $.CONSUME(RgbaFunction) },
                { ALT: () => $.CONSUME(FunctionToken) }
            ]);
            $.MANY_SEP({
                SEP: Comma,
                DEF: () => $.SUBRULE($.cssValue),
            });
            $.CONSUME(CloseParen);
        });

        // Operaciones
        $.RULE('operationValue', () => {
            $.SUBRULE($.atomicValue);
            $.CONSUME(Operator);
            $.SUBRULE($.cssValue);
        });

        this.performSelfAnalysis();
    }
}

const parser = new LayerCSSParser();

// ==================== GENERACIÓN DE CSS ====================
function generateCSS(ast) {
    let css = '';
    const globalVariables = {};
    const mixins = {};
    const extendedSelectors = new Map();
    const mediaQueries = [];
    const layers = new Map();
    const keyframes = [];

    function processNode(node, localVariables = {}, currentSelector = '', currentMedia = '', currentLayer = '') {
        const variables = { ...globalVariables, ...localVariables };
        let output = '';

        switch (node.name) {
            case 'variableDeclaration':
                const varName = node.children.Variable[0].image;
                const value = resolveCSSValue(node.children.cssValue[0], variables);
                
                if (currentSelector) {
                    localVariables[varName] = value;
                    output += `${currentSelector} { --${varName.substring(2)}: ${value}; }\n`;
                } else {
                    globalVariables[varName] = value;
                }
                return output;

            case 'mixinDeclaration':
                const mixinName = node.children.Identifier[0].image;
                mixins[mixinName] = {
                    node: node,
                    variables: { ...localVariables }
                };
                return '';

            case 'includeStatement':
                const includeName = node.children.Identifier[0].image;
                const mixin = mixins[includeName];
                if (!mixin) return '';
                
                const mixinParams = {};
                if (node.children.OpenParen) {
                    const params = node.children.cssValue || [];
                    params.forEach((param, i) => {
                        const paramName = `--param-${i}`;
                        mixinParams[paramName] = resolveCSSValue(param, variables);
                    });
                }
                
                let mixinContent = '';
                mixin.node.children.statement?.forEach(stmt => {
                    mixinContent += processNode(
                        stmt, 
                        { ...mixin.variables, ...mixinParams }, 
                        currentSelector, 
                        currentMedia,
                        currentLayer
                    );
                });
                return mixinContent;

            case 'extendStatement':
                const baseSelector = buildSelector(node.children.selector[0]);
                if (!extendedSelectors.has(currentSelector)) {
                    extendedSelectors.set(currentSelector, new Set());
                }
                extendedSelectors.get(currentSelector).add(baseSelector);
                return '';

            case 'layerStatement':
                const layerName = node.children.Identifier?.[0]?.image || 'unnamed';
                let layerContent = '';
                
                node.children.statement?.forEach(stmt => {
                    layerContent += processNode(
                        stmt, 
                        localVariables, 
                        currentSelector, 
                        currentMedia,
                        layerName
                    );
                });
                
                if (!layers.has(layerName)) {
                    layers.set(layerName, '');
                }
                layers.set(layerName, layers.get(layerName) + layerContent);
                return '';

            case 'keyframesRule':
                const animationName = node.children.Identifier[0].image;
                let keyframesContent = '';
                
                node.children.keyframeBlock?.forEach(block => {
                    keyframesContent += processNode(
                        block, 
                        localVariables, 
                        '', 
                        currentMedia,
                        currentLayer
                    );
                });
                
                keyframes.push(`@keyframes ${animationName} {${keyframesContent}}`);
                return '';

            case 'keyframeBlock':
                const percentage = node.children.Percentage?.[0]?.image || 
                                   node.children.Identifier?.[0]?.image || '';
                let blockContent = '';
                
                node.children.property?.forEach(prop => {
                    blockContent += processNode(
                        prop, 
                        localVariables, 
                        currentSelector, 
                        currentMedia,
                        currentLayer
                    );
                });
                
                return `${percentage}{${blockContent}}`;

            case 'mediaRule':
                const mediaQuery = buildMediaQuery(node.children.mediaQuery[0]);
                let mediaContent = '';
                
                node.children.statement?.forEach(stmt => {
                    mediaContent += processNode(
                        stmt, 
                        localVariables, 
                        currentSelector, 
                        mediaQuery,
                        currentLayer
                    );
                });
                
                mediaQueries.push(`@media ${mediaQuery} {${mediaContent}}`);
                return '';

            case 'standardRule':
                const selectorParts = buildSelector(node.children.selector[0]);
                const fullSelector = currentSelector ? 
                    `${currentSelector} ${selectorParts}` : selectorParts;
                
                let ruleContent = '';
                node.children.property?.forEach(prop => {
                    ruleContent += processNode(
                        prop, 
                        localVariables, 
                        fullSelector, 
                        currentMedia,
                        currentLayer
                    );
                });
                
                if (extendedSelectors.has(selectorParts)) {
                    const extended = [...extendedSelectors.get(selectorParts)].join(', ');
                    ruleContent = `${extended}, ${fullSelector} {${ruleContent}}`;
                } else {
                    ruleContent = `${fullSelector} {${ruleContent}}`;
                }
                
                if (currentLayer) {
                    if (!layers.has(currentLayer)) {
                        layers.set(currentLayer, '');
                    }
                    layers.set(currentLayer, layers.get(currentLayer) + ruleContent);
                    return '';
                }
                
                return currentMedia ? '' : ruleContent;

            case 'nestedRule':
                const nestedSelector = node.children.Identifier[0].image;
                const nestedValue = resolveCSSValue(node.children.cssValue[0], variables);
                const newSelector = currentSelector ? 
                    `${currentSelector} ${nestedSelector}:${nestedValue}` : 
                    `${nestedSelector}:${nestedValue}`;
                
                let nestedContent = '';
                node.children.property?.forEach(prop => {
                    nestedContent += processNode(
                        prop, 
                        localVariables, 
                        newSelector, 
                        currentMedia,
                        currentLayer
                    );
                });
                
                if (currentLayer) {
                    if (!layers.has(currentLayer)) {
                        layers.set(currentLayer, '');
                    }
                    layers.set(currentLayer, layers.get(currentLayer) + nestedContent);
                    return '';
                }
                
                return currentMedia ? '' : nestedContent;

            case 'property':
                const propName = node.children.Identifier[0].image;
                const propValue = resolveCSSValue(node.children.cssValue[0], variables);
                const important = node.children.Important?.[0]?.image || '';
                return `${propName}: ${propValue}${important};`;

            default:
                if (node.children) {
                    return Object.values(node.children)
                        .flat()
                        .map(child => processNode(
                            child, 
                            localVariables, 
                            currentSelector, 
                            currentMedia,
                            currentLayer
                        ))
                        .filter(Boolean)
                        .join('');
                }
                return '';
        }
    }

    function buildSelector(selectorNode) {
        return selectorNode.children.singleSelector
            .map(sel => {
                if (sel.children.Identifier) {
                    return sel.children.Identifier.map(id => id.image).join(' ');
                } else if (sel.children.ClassSelector) {
                    return sel.children.ClassSelector[0].image;
                } else if (sel.children.IdSelector) {
                    return sel.children.IdSelector[0].image;
                } else if (sel.children.Variable) {
                    return sel.children.Variable[0].image;
                }
                return '';
            })
            .join(', ');
    }

    function buildMediaQuery(mediaQueryNode) {
        return mediaQueryNode.children.Identifier
            .map(id => id.image)
            .join(' ');
    }

    function resolveCSSValue(valueNode, variables) {
        if (valueNode.children.atomicValue) {
            const atomic = valueNode.children.atomicValue[0];
            if (atomic.children.StringLiteral) {
                return atomic.children.StringLiteral[0].image;
            }
            if (atomic.children.CssValueWithUnit) {
                return atomic.children.CssValueWithUnit[0].image;
            }
            if (atomic.children.NumberLiteral) {
                return atomic.children.NumberLiteral[0].image;
            }
            if (atomic.children.HexColor) {
                return atomic.children.HexColor[0].image;
            }
            if (atomic.children.Variable) {
                const varName = atomic.children.Variable[0].image;
                return variables[varName] || `var(${varName})`;
            }
            if (atomic.children.Identifier) {
                return atomic.children.Identifier[0].image;
            }
        }
        if (valueNode.children.functionValue) {
            const funcNode = valueNode.children.functionValue[0];
            let funcName;
            if (funcNode.children.RgbaFunction) {
                funcName = funcNode.children.RgbaFunction[0].image.replace('(', '');
            } else {
                funcName = funcNode.children.FunctionToken[0].image.replace('(', '');
            }
            const args = funcNode.children.cssValue?.map(arg => 
                resolveCSSValue(arg, variables)
            ) || [];
            return `${funcName}(${args.join(', ')})`;
        }
        if (valueNode.children.operationValue) {
            const opNode = valueNode.children.operationValue[0];
            const left = resolveCSSValue({ children: { atomicValue: opNode.children.atomicValue } }, variables);
            const operator = opNode.children.Operator[0].image;
            const right = resolveCSSValue(opNode.children.cssValue[0], variables);
            
            if (/^[\d.-]+$/.test(left) && /^[\d.-]+$/.test(right)) {
                return String(eval(`${left}${operator}${right}`));
            }
            return `${left} ${operator} ${right}`;
        }
        if (valueNode.children.listValue) {
            const listItems = valueNode.children.listValue[0].children.atomicValue || [];
            return listItems.map(item => resolveCSSValue({ children: { atomicValue: [item] } }, variables)).join(' ');
        }
        return '';
    }

    // Procesar el AST
    css = processNode(ast.cst);
    
    // Añadir variables globales al inicio
    let globalVarsCSS = '';
    Object.entries(globalVariables).forEach(([varName, value]) => {
        globalVarsCSS += `:root { --${varName.substring(2)}: ${value}; }\n`;
    });
    
    // Añadir capas
    let layersCSS = '';
    layers.forEach((content, layerName) => {
        layersCSS += `@layer ${layerName} {${content}}\n`;
    });
    
    // Añadir keyframes
    let keyframesCSS = keyframes.join('\n');
    
    // Añadir media queries al final
    let mediaCSS = mediaQueries.join('\n');
    
    // Construir el CSS final
    css = `
        ${globalVarsCSS}
        ${css}
        ${layersCSS}
        ${keyframesCSS}
        ${mediaCSS}
    `;
    
    return css;
}

// ==================== MINIFICACIÓN ====================
function minifyCSS(css) {
    console.log('⚙️ Minificando CSS...');
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\n/g, '')
        .replace(/\s*([+>~])\s*/g, '$1')
        .replace(/: /g, ':')
        .replace(/ 0px/g, ' 0')
        .replace(/([: ,])0\.(\d)/g, '$1.$2');
}

// ==================== COMPILADOR PRINCIPAL ====================
async function compileLYC(inputFile, outputFile, options = {}) {
    try {
        // Opciones por defecto
        const { minify = true, sourceMap = false } = options;

        // Verificar archivo de entrada
        if (!fs.existsSync(inputFile)) {
            throw new Error(`El archivo de entrada ${inputFile} no existe`);
        }

        console.log(`🔍 Leyendo archivo de entrada: ${inputFile}`);
        const lycContent = fs.readFileSync(inputFile, 'utf-8');

        if (!lycContent.trim()) {
            throw new Error('El archivo de entrada está vacío');
        }

        console.log('⚙️ Tokenizando contenido...');
        const lexingResult = lexer.tokenize(lycContent);

        if (lexingResult.errors.length > 0) {
            throw new Error(`Errores léxicos:\n${lexingResult.errors.map(e => 
                `• Línea ${e.line}:${e.column} - ${e.message}`
            ).join('\n')}`);
        }

        console.log('⚙️ Analizando sintaxis...');
        parser.input = lexingResult.tokens;
        const cst = parser.stylesheet();

        if (parser.errors.length > 0) {
            throw new Error(`Errores de análisis:\n${parser.errors.map(e => 
                `• Línea ${e.token.startLine}:${e.token.startColumn} - ${e.message}`
            ).join('\n')}`);
        }

        console.log('⚙️ Generando CSS...');
        const cssOutput = generateCSS(cst);

        if (!cssOutput || cssOutput.trim() === '') {
            throw new Error('No se generó ningún contenido CSS (¿archivo de entrada vacío?)');
        }

        let finalCSS = cssOutput;
        if (minify) {
            console.log('⚙️ Minificando CSS...');
            finalCSS = minifyCSS(cssOutput);
        }

        // Crear directorio de salida si no existe
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`⚙️ Escribiendo archivo CSS en: ${outputFile}`);
        fs.writeFileSync(outputFile, finalCSS);

        if (sourceMap) {
            console.log('⚙️ Generando source map...');
            // Implementación de source map aquí
        }

        console.log(`✅ Archivo CSS generado correctamente`);
        console.log(`✅ Tamaño: ${finalCSS.length} caracteres`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

// Ejecución directa cuando se llama desde la línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Uso: node compiler.js <archivo-entrada.lyc> <archivo-salida.css> [--no-minify] [--source-map]');
        process.exit(1);
    }

    const [inputFile, outputFile] = args.slice(0, 2);
    const options = {
        minify: !args.includes('--no-minify'),
        sourceMap: args.includes('--source-map')
    };

    compileLYC(inputFile, outputFile, options).then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { compileLYC };