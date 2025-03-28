import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite";
import type { Database as BrowserDatabase, SqlValue } from 'sql.js';

type SQLTypes = SqlValue & SQLQueryBindings
export type ValidValuesOnly<T> = { [K in keyof T]: T[K] extends string | number | boolean | bigint ? T[K] : never }
export type Definition<T> = { [key in keyof T]: DefinitionOpt }
export type WhereObject<T> = { value: T[] | T, type: '=' | '>' | '<' | '>=' | '<=' | '!=' }
export type Where<T> = { column: keyof Partial<T> & string, opt: WhereObject<T[keyof T]> | undefined }
export type OrderBy<T> = { [key in keyof Partial<T>]: 'ASC' | 'DESC'; }
export interface DefinitionOpt {
  type: 'INTEGER' | 'TEXT' | 'BOOLEAN',
  nullable?: boolean,
  primaryKey?: boolean
}
export type GetOptions<T> = {
  where?: Where<T>[] | undefined;
  limit?: number | undefined;
  orderBy?: OrderBy<T> | undefined;
}

export const eq = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: "=", value } }
export const gt = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: ">", value } }
export const lt = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: "<", value } }
export const ge = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: ">=", value } }
export const le = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: "<=", value } }
export const ne = <T>(value: T & SQLTypes): WhereObject<T> => { return { type: "!=", value } }

const buildOpts = <T>(opts?: GetOptions<T>) => {
  const values: Array<T[keyof T] & SQLTypes> = []

  const builtQuery = (opts?.where ? " WHERE" + opts.where.map((option, i) => {
    if (!option.opt) return

    const where = option.opt.value
    if (Array.isArray(where)) {
      return ` (${where.map(item => {
        values.push(item as T[keyof T] & string)
        return `${option.column} ${option.opt?.type} ?`
      }).join(' OR ')})`
    } else {
      values.push(where as T[keyof T] & string)
      return ` ${option.column} ${option.opt.type} ?` + (i < Object.keys(opts.where!).length - 1 ? ' AND' : '')
    }
  }).join('') : '') +
    (opts?.orderBy ? ` ORDER BY ${Object.entries(opts.orderBy).map(item => `${item[0]}${item[1] ? ` ${item[1]}` : ''}`)}` : '') +
    (opts?.limit ? ` LIMIT ${opts.limit}` : '')

  return { builtQuery, values }
}

export class Table<T extends object, R extends T> {
  name: string
  definition: Definition<T>
  private db: BunDatabase | BrowserDatabase
  private child: new (args: T) => T & R
  constructor(db: BunDatabase | BrowserDatabase, name: string, definition: Definition<T>, child: new (args: T) => T & R) {
    this.name = name
    this.definition = definition
    this.db = db
    this.child = child
  }
  create = (): void => {
    const columnDefs = (Object.entries(this.definition) as [string, DefinitionOpt][]).map(([col, opts]) => `${col} ${opts.type}${opts.primaryKey ? ' PRIMARY KEY' : ''}${!opts.nullable && !opts.primaryKey ? ' NOT NULL' : ''}`).join(', ');
    const query = `CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`
    console.log(query)
    this.db.run(query);
  }
  add = (row: T): void => {
    const columns: (keyof T)[] = Object.keys(row) as (keyof T)[]
    const values: Array<T[keyof T]> = columns.map((col) => row[col])
    const placeholders = columns.map(_ => '?').join(', ')

    const query = `INSERT INTO ${this.name} (${columns.join(', ')}) VALUES (${placeholders})`
    console.log(query)
    if ('create_function' in this.db) this.db.prepare(query).getAsObject(values as Array<T[keyof T] & SQLTypes>)
    else this.db.query(query).run(...values as Array<T[keyof T] & SQLTypes>)
  }
  get = (opts?: GetOptions<T>): R[] => {
    const { builtQuery, values } = buildOpts(opts)
    const query = `SELECT * FROM ${this.name}${builtQuery}`

    console.log(query)
    if ('create_function' in this.db) {
      const stmt = this.db.prepare(query)
      stmt.bind(values)
      const rows: R[] = []
      while (stmt.step()) {
        rows.push(new this.child(stmt.getAsObject() as T))
      }
      return rows
    } else return this.db.query(query).as(this.child).all(...values) as R[]
  }
  delete = (opts?: GetOptions<T>): void => {
    const { builtQuery, values } = buildOpts(opts)
    const query = `DELETE FROM ${this.name}${builtQuery}`

    console.log(query)
    if ('create_function' in this.db) this.db.run(query, values)
    else this.db.prepare(query).run(...values);
  }
  count = (where?: Where<T>[]): number => {
    const { builtQuery, values } = buildOpts({ where })
    const query = `SELECT COUNT(*) as count FROM ${this.name}${builtQuery}`

    if ('create_function' in this.db) return (this.db.prepare(query).getAsObject(values) as { count: number }).count
    else return (this.db.query(query).all(...values)[0] as { count: number }).count ?? 0
  }
  update = (partialRow: Partial<T>, opts?: GetOptions<T>): void => {
    if (!partialRow || Object.keys(partialRow).length === 0) throw new Error('Update requires at least one field to update');

    const updateFields = Object.entries(partialRow).filter(([key]) => key in this.definition).map(([key]) => `${key} = ?`).join(', ');
    const { builtQuery, values } = buildOpts(opts)
    const query = `UPDATE ${this.name} SET ${updateFields} ${builtQuery}`

    const updateValues: (T[keyof T] & SQLTypes)[] = (Object.entries(partialRow) as [keyof T, (T[keyof T] & SQLTypes)][]).filter(([key]) => key in this.definition).map(([_, value]) => value)
    const params: (T[keyof T] & SQLTypes)[] = [...updateValues, ...values];

    console.log(query)
    if ('create_function' in this.db) this.db.run(query, params)
    else this.db.prepare(query).run(...params);
  }
}
