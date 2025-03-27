const fs = require('fs');
const path = require('path');
const math = require('mathjs');

// Función principal del compilador
function compileLYC(inputFile, outputFile, options = { debugMode: false, strictMode: false }) {
  try {
    const lycContent = fs.readFileSync(inputFile, 'utf-8');
    const tokens = lexer(lycContent);
    const ast = parser(tokens);
    semanticAnalysis(ast, options.strictMode);
    const intermediateCode = generateIntermediateCode(ast);
    const optimizedCode = optimize(intermediateCode);
    const cssContent = generateCSS(optimizedCode, options.debugMode);
    fs.writeFileSync(outputFile, cssContent);
    console.log(`Archivo CSS generado: ${outputFile}`);
  } catch (error) {
    console.error(`Error al compilar: ${error.message}`);
    if (options.debugMode && error.debugInfo) {
      console.error('Detalles de depuración:', error.debugInfo);
    }
  }
}

// Análisis léxico (Lexing)
function lexer(lycContent) {
  const tokens = [];
  const tokenPatterns = [
    { pattern: /^--([a-zA-Z0-9-]+):\s*([^;]+);/, type: 'variable' },
    { pattern: /@mixin\s+([a-zA-Z0-9-]+)\s*{([^}]*)}/, type: 'mixin' },
    { pattern: /@include\s+([a-zA-Z0-9-]+);/, type: 'include' },
    { pattern: /@extend\s+([a-zA-Z0-9-.]+);/, type: 'extend' },
    { pattern: /@keyframes\s+([a-zA-Z0-9-]+)\s*{([^}]*)}/, type: 'keyframes' },
    { pattern: /([^{]+)\s*{\s*([^}]+)\s*}/, type: 'rule' }
  ];

  let remainingContent = lycContent.trim();
  while (remainingContent) {
    let matched = false;
    for (const { pattern, type } of tokenPatterns) {
      const match = remainingContent.match(pattern);
      if (match) {
        tokens.push({ type, value: match[0] });
        remainingContent = remainingContent.slice(match[0].length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Token no reconocido: ${remainingContent.slice(0, 20)}...`);
    }
  }

  return tokens;
}

// Análisis sintáctico (Parsing)
function parser(tokens) {
  const ast = { type: 'stylesheet', children: [] };
  const stack = [];

  for (const token of tokens) {
    if (token.type === 'variable') {
      const [, name, value] = token.value.match(/^--([a-zA-Z0-9-]+):\s*([^;]+);/);
      ast.children.push({ type: 'variable', name, value });
    } else if (token.type === 'mixin') {
      const [, name, content] = token.value.match(/@mixin\s+([a-zA-Z0-9-]+)\s*{([^}]*)}/);
      ast.children.push({ type: 'mixin', name, content });
    } else if (token.type === 'rule') {
      const [, selector, properties] = token.value.match(/([^{]+)\s*{\s*([^}]+)\s*}/);
      ast.children.push({
        type: 'rule',
        selector,
        properties: properties.split(';').map(prop => {
          const [property, value] = prop.split(':').map(p => p.trim());
          return { property, value };
        })
      });
    }
  }

  return ast;
}

// Análisis semántico
function semanticAnalysis(ast, strictMode) {
  const globalVariables = {};
  const mixins = {};

  // Primera pasada: Registrar variables y mixins
  for (const node of ast.children) {
    if (node.type === 'variable') {
      globalVariables[node.name] = node.value;
    } else if (node.type === 'mixin') {
      mixins[node.name] = node.content;
    }
  }

  // Segunda pasada: Validar uso de variables y mixins
  for (const node of ast.children) {
    if (node.type === 'rule') {
      for (const prop of node.properties) {
        if (prop.value.includes('var(')) {
          const varName = prop.value.match(/var\(([^)]+)\)/)[1];
          if (!globalVariables[varName]) {
            throw new Error(`Variable no definida: ${varName}`);
          }
        }
      }
    } else if (node.type === 'include') {
      const mixinName = node.value.match(/@include\s+([a-zA-Z0-9-]+)/)[1];
      if (!mixins[mixinName]) {
        throw new Error(`Mixin no definido: ${mixinName}`);
      }
    }
  }

  // Modo estricto: Detectar variables sin usar
  if (strictMode) {
    const usedVariables = new Set();
    for (const node of ast.children) {
      if (node.type === 'rule') {
        for (const prop of node.properties) {
          const match = prop.value.match(/var\(([^)]+)\)/);
          if (match) {
            usedVariables.add(match[1]);
          }
        }
      }
    }

    for (const varName of Object.keys(globalVariables)) {
      if (!usedVariables.has(varName)) {
        console.warn(`Advertencia: Variable no usada: ${varName}`);
      }
    }
  }
}

// Generación de código intermedio
function generateIntermediateCode(ast) {
  let intermediateCode = '';

  for (const node of ast.children) {
    if (node.type === 'rule') {
      intermediateCode += `${node.selector} {\n`;
      for (const prop of node.properties) {
        intermediateCode += `  ${prop.property}: ${prop.value};\n`;
      }
      intermediateCode += '}\n';
    }
  }

  return intermediateCode;
}

// Optimización
function optimize(intermediateCode) {
  const rules = {};
  const lines = intermediateCode.split('\n');

  lines.forEach(line => {
    const match = line.match(/([^{]+)\s*{\s*([^}]+)\s*}/);
    if (match) {
      const [_, selector, properties] = match;
      if (!rules[selector]) {
        rules[selector] = new Set();
      }
      properties.split(';').forEach(prop => {
        if (prop.trim()) {
          rules[selector].add(prop.trim());
        }
      });
    }
  });

  let optimizedCSS = '';
  for (const [selector, props] of Object.entries(rules)) {
    optimizedCSS += `${selector} {\n${Array.from(props).join(';\n')};\n}\n`;
  }

  return optimizedCSS;
}

// Generación de código final
function generateCSS(intermediateCode, debugMode) {
  if (debugMode) {
    console.log('Código intermedio:', intermediateCode);
  }

  return minifyCSS(intermediateCode);
}

// Minificación
function minifyCSS(css) {
  return css.replace(/\s+/g, ' ').trim();
}

// Ejecutar el compilador
const inputFile = process.argv[2];
const outputFile = process.argv[3];
if (!inputFile || !outputFile) {
  console.error('Uso: node compiler.js <archivo_entrada> <archivo_salida>');
  process.exit(1);
}

compileLYC(inputFile, outputFile, { debugMode: true, strictMode: true });