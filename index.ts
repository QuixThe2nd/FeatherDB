import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite";
import { type Database as BrowserDatabase, type SqlValue } from 'sql.js';

type SQLTypes = SqlValue & SQLQueryBindings
export type ValidValuesOnly<T> = { [K in keyof T]: T[K] extends string | number | boolean | bigint ? T[K] : never }
export interface DefinitionOpt { 
  type: 'INTEGER' | 'REAL' | 'TEXT' | 'BOOLEAN', 
  nullable?: boolean, 
  primaryKey?: boolean,
  autoIncrement?: boolean 
}
export type Definition<T> = { [key in keyof T]: DefinitionOpt }
export type WhereObject<T> = { value: T[] | T, type: '=' | '>' | '<' | '>=' | '<=' | '!=' }
export type Where<T> = { column: keyof Partial<T> & string, opt: WhereObject<T[keyof T]> | undefined }
export type OrderBy<T> = { [key in keyof Partial<T>]: 'ASC' | 'DESC'; }
export type GetOptions<T> = { where?: Where<T>[] | undefined; limit?: number | undefined; orderBy?: OrderBy<T> | undefined }
export type AIColumn<T extends object, D extends Definition<T>> = { [K in keyof D]: D[K]['autoIncrement'] extends true ? K : never }[keyof D];
export type PrimaryColumn<T extends object, D extends Definition<T>> = { [K in keyof D]: D[K]['primaryKey'] extends true ? K : undefined }[keyof D];

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

export interface TableSchema<T extends object, RowClass, D extends Definition<T>> {
  readonly name: string;
  readonly definition: D;
  readonly child: new (args: T) => RowClass;
}

export class Table<T extends object, RowClass, D extends Definition<T>> {
  private db: BunDatabase | BrowserDatabase;
  private schema: TableSchema<T, RowClass, D>;

  constructor(db: BunDatabase | BrowserDatabase, schema: TableSchema<T, RowClass, D>) {
    this.db = db;
    this.schema = schema;
  }
  create = (): this => {
    const columnDefs = (Object.entries(this.schema.definition) as [string, DefinitionOpt][]).map(([col, opts]) => {
      let columnDef = `${col} ${opts.type}`;

      if (opts.primaryKey) {
        columnDef += ' PRIMARY KEY';
        if (opts.autoIncrement && opts.type === 'INTEGER') columnDef += ' AUTOINCREMENT';
      }

      if (!opts.nullable && !opts.primaryKey) columnDef += ' NOT NULL';
      
      return columnDef;
    }).join(', ');

    const query = `CREATE TABLE IF NOT EXISTS \`${this.schema.name}\` (${columnDefs})`
    console.log(query)
    this.db.run(query);
    return this
  }
  add<R extends T | Omit<T, AIColumn<T, D>>>(row: R): RowClass {
    const columns = Object.keys(row) as (keyof R)[];
    const values: Array<R[keyof R]> = columns.map((col) => row[col]);
    const placeholders = columns.map(_ => '?').join(', ')

    const query = `INSERT INTO ${this.schema.name} (${columns.join(', ')}) VALUES (${placeholders})`
    console.log(query)
    const primaryKeyCol = Object.entries(this.schema.definition).find(([_, _def]) => {
      const def = _def as DefinitionOpt;
      return def.primaryKey && def.autoIncrement && def.type === 'INTEGER'
    })?.[0];
    

    if ('create_function' in this.db) return new this.schema.child(this.db.prepare(query).getAsObject(values as Array<T[keyof T] & SQLTypes>) as T);
    else return this.get({ where: [{ column: primaryKeyCol as keyof T & string, opt: eq(this.db.query(query).run(...values as Array<T[keyof T] & SQLTypes>).lastInsertRowid as T[keyof T] & number) }] })[0]
  }
  get = (opts?: GetOptions<T>): RowClass[] => {
    const { builtQuery, values } = buildOpts(opts)
    const query = `SELECT * FROM \`${this.schema.name}\`${builtQuery}`

    console.log(query)
    if ('create_function' in this.db) {
      const stmt = this.db.prepare(query)
      stmt.bind(values)
      const rows: RowClass[] = []
      while (stmt.step()) {
        rows.push(new this.schema.child(stmt.getAsObject() as T))
      }
      return rows
    } else return this.db.query(query).as(this.schema.child).all(...values) as RowClass[]
  }
  delete = (opts?: GetOptions<T>): void => {
    const { builtQuery, values } = buildOpts(opts)
    const query = `DELETE FROM ${this.schema.name}${builtQuery}`

    console.log(query)
    if ('create_function' in this.db) this.db.run(query, values)
    else this.db.prepare(query).run(...values);
  }
  count = (where?: Where<T>[]): number => {
    const { builtQuery, values } = buildOpts({ where })
    const query = `SELECT COUNT(*) as count FROM ${this.schema.name}${builtQuery}`

    if ('create_function' in this.db) return (this.db.prepare(query).getAsObject(values) as { count: number }).count
    else return (this.db.query(query).all(...values)[0] as { count: number }).count ?? 0
  }
  update = (partialRow: Partial<T>, opts?: GetOptions<T>): void => {
    if (!partialRow || Object.keys(partialRow).length === 0) throw new Error('Update requires at least one field to update');

    const updateFields = Object.entries(partialRow).filter(([key]) => key in this.schema.definition).map(([key]) => `${key} = ?`).join(', ');
    const { builtQuery, values } = buildOpts(opts)
    const query = `UPDATE ${this.schema.name} SET ${updateFields} ${builtQuery}`

    const updateValues: (T[keyof T] & SQLTypes)[] = (Object.entries(partialRow) as [keyof T, (T[keyof T] & SQLTypes)][]).filter(([key]) => key in this.schema.definition).map(([_, value]) => value)
    const params: (T[keyof T] & SQLTypes)[] = [...updateValues, ...values];

    console.log(query)
    if ('create_function' in this.db) this.db.run(query, params)
    else this.db.prepare(query).run(...params);
  }
}
