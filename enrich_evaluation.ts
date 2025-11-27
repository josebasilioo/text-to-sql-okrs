import fs from 'fs';
import path from 'path';

// interface DatasetRow {
//   texto: string;
//   categoria: string;
//   complexidade: string;
//   sqlEsperado: string;
// }

// interface EvaluationRow {
//   pergunta: string;
//   qtd_retries: string;
//   em: string;
//   ex: string;
//   cs: string;
//   ts: string;
//   qas: string;
//   sql_esperado: string;
//   sql_final_executado: string;
//   categoria?: string;
//   complexidade?: string;
// }

// Função para fazer parse de CSV respeitando aspas
function parseCSVLine(line: string): string[] {
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
  parts.push(currentPart);

  return parts;
}

// Ler o arquivo TCC - Dataset.csv
const datasetPath = path.join(__dirname, 'database', 'TCC - Dataset.csv');
const datasetContent = fs.readFileSync(datasetPath, 'utf-8');
const datasetLines = datasetContent.split('\n').slice(1); // Pular cabeçalho

// Criar um mapa de pergunta -> {categoria, complexidade}
const questionMap = new Map<string, { categoria: string; complexidade: string }>();

for (const line of datasetLines) {
  if (!line.trim()) continue;

  const parts = parseCSVLine(line);
  const texto = parts[0]?.trim() || '';
  const categoria = parts[1]?.trim() || '';
  const complexidade = parts[2]?.trim() || '';

  if (texto) {
    questionMap.set(texto, { categoria, complexidade });
  }
}

console.log(`📊 Carregadas ${questionMap.size} perguntas do dataset TCC`);

// Ler o arquivo evaluation-report.csv
const evalPath = path.join(__dirname, 'results', 'evaluation-report.csv');
const evalContent = fs.readFileSync(evalPath, 'utf-8');
const evalLines = evalContent.split('\n');

// Processar o arquivo de avaliação
const enrichedLines: string[] = [];

// Cabeçalho com novas colunas
const header = evalLines[0];
enrichedLines.push(header + ',categoria,complexidade');

// Processar cada linha de dados
for (let i = 1; i < evalLines.length; i++) {
  const line = evalLines[i];
  if (!line.trim()) continue;

  const parts = parseCSVLine(line);
  const pergunta = parts[0]?.trim() || '';

  // Buscar categoria e complexidade no mapa
  const metadata = questionMap.get(pergunta);

  if (metadata) {
    // Adicionar categoria e complexidade
    enrichedLines.push(`${line},${metadata.categoria},${metadata.complexidade}`);
    console.log(
      `✓ Enriquecido: "${pergunta.substring(0, 50)}..." -> ${metadata.categoria} (${metadata.complexidade})`
    );
  } else {
    // Se não encontrou, adicionar vazios
    enrichedLines.push(`${line},,`);
    console.log(`⚠️  Não encontrado: "${pergunta.substring(0, 50)}..."`);
  }
}

// Escrever o arquivo enriquecido
const outputPath = path.join(__dirname, 'results', 'evaluation-report.csv');
fs.writeFileSync(outputPath, enrichedLines.join('\n'), 'utf-8');

console.log(`\n✅ Arquivo evaluation-report.csv enriquecido com sucesso!`);
console.log(`📊 Total de linhas processadas: ${enrichedLines.length - 1}`);
