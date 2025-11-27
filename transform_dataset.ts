import fs from 'fs';
import path from 'path';

interface GoldEntry {
  question: string;
  gold: string;
}

// Ler o arquivo CSV
const csvPath = path.join(__dirname, 'database', 'TCC - Dataset.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Separar as linhas
const lines = csvContent.split('\n');

// Pular o cabeçalho (primeira linha)
const dataLines = lines.slice(1);

// Processar cada linha
const goldData: GoldEntry[] = [];

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

  // Extrair Texto (coluna 0) e SQL Esperado (coluna 3)
  const question = parts[0]?.trim() || '';
  const gold = parts[3]?.trim() || '';

  // Adicionar ao array se ambos estiverem presentes
  if (question && gold) {
    goldData.push({
      question,
      gold,
    });
  }
}

// Escrever o arquivo JSON
const outputPath = path.join(__dirname, 'database', 'gold.json');
fs.writeFileSync(outputPath, JSON.stringify(goldData, null, 2), 'utf-8');

console.log(`✅ Arquivo gold.json criado com sucesso!`);
console.log(`📊 Total de registros: ${goldData.length}`);
