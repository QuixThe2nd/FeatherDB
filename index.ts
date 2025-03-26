import { Database, type SQLQueryBindings } from "bun:sqlite";

// Modal 
export type Modal = {
  [key: string]: SQLQueryBindings
}

export type Definition<T extends Modal> = {
  [key in keyof T]: {
    type: 'INTEGER' | 'TEXT' | 'BOOLEAN',
    nullable?: boolean
  }
}

export type OrderBy<T extends Modal> = {
  column: keyof T;
  direction?: 'ASC' | 'DESC';
}

export type GetOptions<T extends Modal> = {
  where?: Partial<T>;
  limit?: number;
  orderBy?: OrderBy<T> | OrderBy<T>[];
}

export class Row<T extends Modal> {
  private data: T

  constructor(data: T) {
    this.data = data
  }

  get values() {
    return this.data
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  static fromDb<T extends Modal>(data: Record<string, unknown>, modal: T): Row<T> {
    const convertedData: Partial<T> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key in modal) {
        const modalKey = key as keyof T;
        const modalType = modal[modalKey];
        
        if (modalType === 'HEX' && typeof value === 'string') convertedData[modalKey as keyof T] = (value.startsWith('0x') ? value : `0x${value}`) as T[keyof T];
        else convertedData[modalKey as keyof T] = value as T[keyof T];
      }
    }

    return new Row<T>(convertedData as T);
  }

  getRawData(): T {
    const rawData: Partial<T> = {};
    
    for (const key in this) {
      if (typeof this[key] !== 'function' && Object.prototype.hasOwnProperty.call(this, key)) {
        rawData[key as keyof T] = (this as unknown as T)[key as keyof T];
      }
    }
    
    return rawData as T;
  }
}

export class Table<T extends Modal> {
  name: string
  definition: Definition<T>
  private db: Database
  private child: new (args: T) => T

  constructor(db: Database, name: string, definition: Definition<T>, child: new (args: T) => T) {
    this.name = name
    this.definition = definition
    this.db = db
    this.child = child
  }

  create = () => {
    const columnDefs = Object.entries(this.definition).map(([col, opts]) => `${col} ${opts.type} ${opts.nullable ? '' : 'NOT NULL'}`).join(', ');
    console.log(`CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`)
    this.db.run(`CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`);
  }

  add = (row: T) => {
    const columns: (keyof T)[] = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    const values = columns.map(col => row[col])

    const sql = `INSERT INTO ${this.name} (${columns.join(', ')}) VALUES (${placeholders})`
    return this.db.run(sql, values)
  }

  get = (options?: GetOptions<T>): Row<T>[] => {
    let query = `SELECT * FROM ${this.name}`;
    const params: (string | number)[] = [];

    // Process WHERE clause
    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = Object.entries(options.where)
        .filter(([key]) => key in this.definition)
        .map(([key, value]) => {
          if (!value) return
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    // Process ORDER BY clause
    if (options?.orderBy) {
      const orderByClauses = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      
      if (orderByClauses.length > 0) {
        const orderByStatements = orderByClauses
          .filter(order => order.column in this.definition)
          .map(order => `${String(order.column)} ${order.direction || 'ASC'}`)
          .join(', ');
          
        if (orderByStatements) query += ` ORDER BY ${orderByStatements}`;
      }
    }
    
    // Process LIMIT clause
    if (options?.limit !== undefined && options.limit > 0) {
      query += ` LIMIT ${options.limit}`;
    }
    
    const children = this.db.query(query).as(this.child).all(...params);
    return children.map(child => new Row<T>(child))
  }

  delete = (partialRow?: Partial<T>): void => {
    let query = `DELETE FROM ${this.name}`;
    
    const params: SQLQueryBindings[] = [];

    if (partialRow && Object.keys(partialRow).length > 0) {
      const conditions = Object.entries(partialRow)
        .filter(([key]) => key in this.definition)
        .map(([key, value]) => {
          if (!value) return
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    const stmt = this.db.prepare(query)
    stmt.run(...params);
  }

  count = (options?: GetOptions<T>): number => {
    let query = `SELECT COUNT(*) as count FROM ${this.name}`;
    
    const params: (string | number)[] = [];

    // Process WHERE clause
    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = Object.entries(options.where)
        .filter(([key]) => key in this.definition)
        .map(([key, value]) => {
          if (!value) return
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    const result = this.db.query(query).get(...params) as object;
    return result && 'count' in result ? (result.count as number) : 0;
  }

  update = (partialRow: Partial<T>, whereClause: Partial<T>) => {
    if (!partialRow || Object.keys(partialRow).length === 0) {
      throw new Error('Update requires at least one field to update');
    }
    
    if (!whereClause || Object.keys(whereClause).length === 0) {
      throw new Error('Update requires a where clause to identify rows');
    }
    
    const updateFields = Object.entries(partialRow)
      .filter(([key]) => key in this.definition)
      .map(([key]) => `${key} = ?`)
      .join(', ');
      
    const whereFields = Object.entries(whereClause)
      .filter(([key]) => key in this.definition)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    
    if (!updateFields || !whereFields) {
      throw new Error('Invalid update or where clause fields');
    }
    
    const query = `UPDATE ${this.name} SET ${updateFields} WHERE ${whereFields}`;
    
    const updateValues = Object.entries(partialRow)
      .filter(([key]) => key in this.definition)
      .map(([_, value]) => {
        if(typeof value === 'undefined') return
        if (typeof value === 'string' && value.startsWith('0x')) return value.toString();
        return value;
      });
      
    const whereValues = Object.entries(whereClause)
      .filter(([key]) => key in this.definition)
      .map(([_, value]) => {
        if (typeof value === 'string' && value.startsWith('0x')) return value.toString();
        return value;
      });
    
    const params = [...updateValues, ...whereValues];
    
    const stmt = this.db.prepare(query)
    return stmt.run(...params);
  }
}
