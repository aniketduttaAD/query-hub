declare module 'node-sql-parser' {
  export interface ParserOptions {
    database?: string;
  }

  export class Parser {
    astify(sql: string, options?: ParserOptions): unknown;
  }
}
