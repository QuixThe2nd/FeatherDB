import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite";
import type { Database as BrowserDatabase, SqlValue } from 'sql.js'
type SQLTypes = SqlValue & SQLQueryBindings
export type ValidValuesOnly<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | bigint ? T[K] : never;
}
export type DefinitionOpt = {
  type: 'INTEGER' | 'TEXT' | 'BOOLEAN',
  nullable?: boolean,
  primaryKey?: boolean
}
export type Definition<T> = {
  [key in keyof T]: DefinitionOpt
}
export type OrderBy<T> = {
  [key in keyof Partial<T>]: 'ASC' | 'DESC';
}
export type GetOptions<T> = {
  where?: Partial<T>;
  limit?: number;
  orderBy?: OrderBy<T>;
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
  create = () => {
    const columnDefs = (Object.entries(this.definition) as [string, DefinitionOpt][]).map(([col, opts]) => {
      let def = `${col} ${opts.type}`;
      
      if (opts.primaryKey) def += ' PRIMARY KEY';

      if (!opts.nullable && !opts.primaryKey) def += ' NOT NULL';
      
      return def;
    }).join(', ');
    
    console.log(`CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`)
    this.db.run(`CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`);
  }
  add = (row: T) => {
    const columns: (keyof T)[] = Object.keys(row) as (keyof T)[]
    const values: Array<T[keyof T]> = []
    columns.map((col) => values.push(row[col]))
    const placeholders = columns.map((_, i) => `?${i+1}`).join(', ')
    const sql = `INSERT INTO ${this.name} (${columns.join(', ')}) VALUES (${placeholders})`
    console.log(sql)
    if ('create_function' in this.db) return this.db.prepare(sql).getAsObject(values as Array<T[keyof T] & SQLTypes>)
    else return this.db.query(sql).all(...values as Array<T[keyof T] & SQLTypes>)
  }
  get = (opts?: GetOptions<T>): R[] => {
    const values: Array<T[keyof T] & SQLTypes> = []
    const query = `SELECT * FROM ${this.name}` + 
    (opts?.where ? " WHERE" + Object.entries(opts.where).map(([key, value], i) => {
      const col: keyof T & string = key as keyof T & string
      values.push(value as T[keyof T] & SQLTypes)
      return ` ${col} = ?${i+1}` + (i < Object.keys(opts.where!).length-1 ? ' AND' : '')
    }) : '') +
    (opts?.orderBy ? ` ORDER BY ${Object.entries(opts.orderBy).map(item => `${item[0]}${item[1] ? ` ${item[1]}` : ''}`)}` : '') +
    (opts?.limit ? ` LIMIT ${opts.limit}` : '')
    const db = this.db
    if ('create_function' in db) {
      const bindings: { [key: `?${number}`]: T[keyof T] & SQLTypes } = {}
      for (let i = 0; i < values.length; i++) {
        bindings[`?${i+1}`] = values[i]!
      }
      const stmt = db.prepare(query)
      stmt.bind(bindings)
      const rows: R[] = []
      while (stmt.step()) {
        rows.push(new this.child(stmt.getAsObject() as T))
      }
      return rows
    } else return db.query(query).as(this.child).all(...values) as R[]
  }
  delete = (partialRow?: Partial<T>): void => {
    let query = `DELETE FROM ${this.name}`;
    
    const params: (T[keyof T] & SQLTypes)[] = [];
    if (partialRow && Object.keys(partialRow).length > 0) {
      const conditions = (Object.entries(partialRow) as [keyof T & string, T[keyof T]][])
        .filter(([key]) => key in this.definition)
        .map(([key, value]) => {
          if (!value) return
          params.push(value as T[keyof T] & SQLTypes);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    if ('create_function' in this.db) this.db.run(query, params)
    else this.db.prepare(query).run(...params);
  }
  count = (options?: GetOptions<T & ValidValuesOnly<T>>): number => {
    let query = `SELECT COUNT(*) as count FROM ${this.name}`;
    
    const params: (T[keyof T] & SQLTypes)[] = [];

    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = (Object.entries(options.where) as [keyof T & string, T[keyof T] & SQLTypes][])
        .filter(([key]) => key in this.definition)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    if ('create_function' in this.db) {
      const bindings: { [key: `?${number}`]: T[keyof T] & SQLTypes } = {}
      for (let i = 0; i < params.length; i++) {
        bindings[`?${i+1}`] = params[i]!
      }
      const stmt = this.db.prepare(query)
      stmt.bind(bindings)
    return this.db.prepare(query).getAsObject(bindings).count as number
    } else return (this.db.query(query).all(...params)[0] as { count: number }).count ?? 0
  }
  update = (partialRow: Partial<T>, whereClause: Partial<T>) => {
    if (!partialRow || Object.keys(partialRow).length === 0) throw new Error('Update requires at least one field to update');
    
    if (!whereClause || Object.keys(whereClause).length === 0) throw new Error('Update requires a where clause to identify rows');
    
    const updateFields = Object.entries(partialRow)
      .filter(([key]) => key in this.definition)
      .map(([key]) => `${key} = ?`)
      .join(', ');
      
    const whereFields = Object.entries(whereClause)
      .filter(([key]) => key in this.definition)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    
    if (!updateFields || !whereFields) throw new Error('Invalid update or where clause fields');
    
    const query = `UPDATE ${this.name} SET ${updateFields} WHERE ${whereFields}`;
    
    const updateValues: (T[keyof T] & SQLTypes)[] = (Object.entries(partialRow) as [keyof T, (T[keyof T] & SQLTypes)][])
      .filter(([key]) => key in this.definition)
      .map(([_, value]) => value);
      
    const whereValues: (T[keyof T] & SQLTypes)[] = (Object.entries(whereClause) as [keyof T, (T[keyof T] & SQLTypes)][])
      .filter(([key]) => key in this.definition)
      .map(([_, value]) => value);
    
    const params: (T[keyof T] & SQLTypes)[] = [...updateValues, ...whereValues];
    
    if ('create_function' in this.db) this.db.run(query, params)
    else this.db.prepare(query).run(...params);
  }
}
