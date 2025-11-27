// componentMatchAccuracyExtended.ts
// Component Match Accuracy (CM) — versão expandida, conforme o paper, com muito mais cláusulas.

type ComponentMap = Record<string, Set<string>>;

/* -----------------------------------------------------
 * Utilidades gerais
 * ----------------------------------------------------*/
function normalizeSQL(sql: string): string {
  return sql
    .replace(/\r|\n|\t/g, ' ')
    .replace(/--.*?(\n|$)/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cleanIdentifier(s: string): string {
  return s
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+as\s+\w+$/i, '')
    .replace(/\s+\w+$/i, '')
    .trim()
    .toLowerCase();
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (ch === '(') depth++;
    if (ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function extractClause(sql: string, clause: string, next: string[]): string {
  const nextPattern = next.length ? `(?=\\b(?:${next.join('|')})\\b)` : '(?=$)';
  const re = new RegExp(`\\b${clause}\\b\\s*(.*?)\\s*${nextPattern}`, 'i');
  const m = re.exec(sql);
  return m ? m[1].trim() : '';
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function splitLogical(expr: string): string[] {
  return expr
    .split(/\s+and\s+|\s+or\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* -----------------------------------------------------
 * Extração de CTEs (WITH)
 * ----------------------------------------------------*/
function extractCTEs(sql: string): Set<string> {
  const re = /\bwith\b\s+(.*?)\bselect\b/is;
  const m = re.exec(sql);
  if (!m) return new Set();

  const content = m[1].trim();

  return new Set(
    splitTopLevelCommas(content)
      .map((cte) => cte.split(/\bas\b/i)[0].trim())
      .map(cleanIdentifier)
  );
}

/* -----------------------------------------------------
 * Decomposição principal
 * ----------------------------------------------------*/
export function decomposeSQL(sqlRaw: string): ComponentMap {
  const sql = normalizeSQL(sqlRaw);

  const next = [
    'with',
    'select',
    'from',
    'where',
    'group by',
    'having',
    'order by',
    'limit',
    'offset',
    'union',
    'intersect',
    'except',
    'returning',
  ];

  const selectC = extractClause(sql, 'select', next);
  const fromC = extractClause(sql, 'from', next);
  const whereC = extractClause(sql, 'where', next);
  const groupByC = extractClause(sql, 'group by', next);
  const havingC = extractClause(sql, 'having', next);
  const orderByC = extractClause(sql, 'order by', next);
  const limitC = extractClause(sql, 'limit', next);
  const offsetC = extractClause(sql, 'offset', next);
  const returningC = extractClause(sql, 'returning', next);

  // DISTINCT
  const distinctUsed = /\bdistinct\b/i.test(sql);

  // JOIN tables
  const joinRegex = /\b(?:inner|left|right|full|cross|natural)?\s*join\b\s*([^\s(]+)/gi;
  const joins = new Set<string>();
  let jm;
  while ((jm = joinRegex.exec(sql)) !== null) joins.add(cleanIdentifier(jm[1]));

  // UNION / INTERSECT / EXCEPT
  const unions = new Set<string>();
  if (/\bunion all\b/i.test(sql)) unions.add('union all');
  else if (/\bunion\b/i.test(sql)) unions.add('union');

  const intersects = new Set<string>();
  if (/\bintersect\b/i.test(sql)) intersects.add('intersect');

  const excepts = new Set<string>();
  if (/\bexcept\b/i.test(sql)) excepts.add('except');

  // Window: OVER (PARTITION BY ..)
  const windowRegex = /\bover\s*\((.*?)\)/gi;
  const windows = new Set<string>();
  let w;
  while ((w = windowRegex.exec(sql)) !== null) {
    windows.add(cleanIdentifier(w[1]));
  }

  return {
    WITH: extractCTEs(sql),
    SELECT: new Set(splitTopLevelCommas(selectC).map(cleanIdentifier)),
    DISTINCT: distinctUsed ? new Set(['distinct']) : new Set(),
    FROM: new Set(splitTopLevelCommas(fromC).map(cleanIdentifier)),
    JOIN: joins,
    WHERE: new Set(whereC ? splitLogical(whereC).map(cleanIdentifier) : []),
    GROUP_BY: new Set(splitTopLevelCommas(groupByC).map(cleanIdentifier)),
    HAVING: new Set(havingC ? splitLogical(havingC).map(cleanIdentifier) : []),
    ORDER_BY: new Set(
      splitTopLevelCommas(orderByC).map((o) => cleanIdentifier(o.replace(/\s+(asc|desc)$/, '')))
    ),
    LIMIT: limitC ? new Set([limitC]) : new Set(),
    OFFSET: offsetC ? new Set([offsetC]) : new Set(),
    WINDOW: windows,
    UNION: unions,
    INTERSECT: intersects,
    EXCEPT: excepts,
    RETURNING: new Set(returningC ? splitTopLevelCommas(returningC).map(cleanIdentifier) : []),
  };
}

/* -----------------------------------------------------
 * Métrica Component Match Accuracy (CM)
 * ----------------------------------------------------*/
export function componentMatchAccuracy(predSQL: string, goldSQL: string) {
  const pred = decomposeSQL(predSQL);
  const gold = decomposeSQL(goldSQL);

  const components = Object.keys(pred);

  const results: Record<string, number> = {};
  let sum = 0;

  for (const c of components) {
    const match = setsEqual(pred[c], gold[c]) ? 1 : 0;
    results[c] = match;
    sum += match;
  }

  const CM = sum / components.length;

  return {
    componentMatches: results,
    CM: Number(CM.toFixed(4)),
  };
}

/* ----------------------------- TEST QUICK -------------------------------*/
if (require.main === module) {
  const gold =
    'WITH x AS (SELECT id FROM t) SELECT DISTINCT a, b FROM x JOIN y ON x.id = y.id WHERE a = 1 GROUP BY b HAVING b > 1 UNION SELECT a,b FROM z';
  const pred =
    'WITH x AS (SELECT id FROM t) SELECT DISTINCT b, a FROM x JOIN y ON y.id = x.id WHERE a = 1 GROUP BY b HAVING b > 1 UNION SELECT a,b FROM z';

  console.log(componentMatchAccuracy(pred, gold));
}
