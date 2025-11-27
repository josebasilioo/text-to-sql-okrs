/**
 * Validador SQL que verifica comandos perigosos antes da execução
 */
export class SQLValidator {
  private readonly forbidden = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER'];
  private readonly forbiddenRegex: RegExp;

  constructor() {
    // Cria regex que busca palavras inteiras (word boundaries) case-insensitive
    const pattern = this.forbidden.map((cmd) => `\\b${cmd}\\b`).join('|');
    this.forbiddenRegex = new RegExp(pattern, 'i');
  }

  /**
   * Valida se a SQL contém comandos perigosos
   * @param sql Query SQL a ser validada
   * @throws Error com mensagem "UNSUPPORTED SYNTAX ERROR" se encontrar comandos perigosos
   */
  validate(sql: string): void {
    if (this.forbiddenRegex.test(sql)) {
      throw new Error('UNSUPPORTED SYNTAX ERROR');
    }
  }

  /**
   * Valida e retorna true se seguro, false caso contrário
   * @param sql Query SQL a ser validada
   * @returns true se seguro, false se contém comandos perigosos
   */
  isValid(sql: string): boolean {
    try {
      this.validate(sql);
      return true;
    } catch {
      return false;
    }
  }
}
