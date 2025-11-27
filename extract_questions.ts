import fs from 'fs';
import path from 'path';

// Ler o arquivo CSV
const csvPath = path.join(__dirname, 'database', 'TCC - Dataset.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Separar as linhas
const lines = csvContent.split('\n');

// Pular o cabeçalho (primeira linha)
const dataLines = lines.slice(1);

// Processar cada linha
const questions: string[] = [];

for (const line of dataLines) {
  // Pular linhas vazias
  if (!line.trim()) continue;

  // Dividir a linha respeitando vírgulas dentro de aspas
  const parts: string[] = [];
  let currentPart = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      parts.push(currentPart);
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  parts.push(currentPart); // Adicionar a última parte

  // Extrair apenas Texto (coluna 0)
  const question = parts[0]?.trim() || '';

  // Adicionar ao array se estiver presente
  if (question) {
    questions.push(question);
  }
}

// Escrever o arquivo JSON
const outputPath = path.join(__dirname, 'database', 'predict.json');
fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), 'utf-8');
