const fs = require('fs');
const path = require('path');

/**
 * Script para transformar o CSV TCC - Dataset.csv em gold.json
 *
 * Extrai as colunas "Texto" e "SQL Esperado" do CSV e gera um JSON
 * com formato: [{ question: "...", gold: "..." }]
 */

// Definir __dirname de forma compatível (funciona em CommonJS)
const __dirname = path.dirname(
  require.main?.filename || process.argv[1] || __filename || process.cwd()
);

const csvPath = path.resolve(__dirname, 'database', 'TCC - Dataset.csv');
const jsonPath = path.resolve(__dirname, 'database', 'gold.json');

// Ler o arquivo CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter((line) => line.trim());

// Pular cabeçalho
const dataLines = lines.slice(1);

const results = [];

// Processar cada linha do CSV
for (const line of dataLines) {
  // Processar CSV manualmente considerando aspas
  const fields = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Aspas duplas escapadas
        currentField += '"';
        i++; // Pular próxima aspa
      } else {
        // Toggle aspas
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Fim do campo
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  // Adicionar último campo
  fields.push(currentField.trim());

  // Extrair colunas "Texto" (índice 0) e "SQL Esperado" (índice 3)
  if (fields.length >= 4 && fields[0] && fields[3]) {
    const texto = fields[0].replace(/^"|"$/g, '');
    const sqlEsperado = fields[3].replace(/^"|"$/g, '');

    results.push({
      question: texto,
      gold: sqlEsperado,
    });
  }
}

// Escrever o arquivo JSON
fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
console.log(`✅ Processados ${results.length} registros`);
console.log(`📄 Arquivo gerado: ${jsonPath}`);
