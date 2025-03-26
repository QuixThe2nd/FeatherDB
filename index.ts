import { Database, type SQLQueryBindings } from "bun:sqlite";

export type Modal = {
  [key: string]: 'HEX' | 'INTEGER' | 'STRING'
}

export type ModalTypeMap = {
  'HEX': `0x${string}`;
  'INTEGER': number;
  'STRING': string;
  'BOOLEAN': number
}

export type RowType<T extends Modal> = {
  [K in keyof T]: ModalTypeMap[T[K]]
}

export type OrderBy<T extends Modal> = {
  column: keyof T;
  direction?: 'ASC' | 'DESC';
}

export type GetOptions<T extends Modal> = {
  where?: Partial<RowType<T>>;
  limit?: number;
  orderBy?: OrderBy<T> | OrderBy<T>[];
}

export class Row<T extends Modal> {
  constructor(data: RowType<T>) {
    Object.assign(this, data);
  }

  get<K extends keyof T>(key: K): ModalTypeMap[T[K]] {
    return (this as unknown as RowType<T>)[key];
  }

  static fromDb<T extends Modal>(data: Record<string, unknown>, modal: T): Row<T> {
    const convertedData: Partial<RowType<T>> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key in modal) {
        const modalKey = key as keyof T;
        const modalType = modal[modalKey];
        
        if (modalType === 'HEX' && typeof value === 'string') convertedData[modalKey as keyof RowType<T>] = (value.startsWith('0x') ? value : `0x${value}`) as RowType<T>[keyof RowType<T>];
        else convertedData[modalKey as keyof RowType<T>] = value as RowType<T>[keyof RowType<T>];
      }
    }

    return new Row<T>(convertedData as RowType<T>);
  }

  getRawData(): RowType<T> {
    const rawData: Partial<RowType<T>> = {};
    
    for (const key in this) {
      if (typeof this[key] !== 'function' && Object.prototype.hasOwnProperty.call(this, key)) {
        rawData[key as keyof RowType<T>] = (this as unknown as RowType<T>)[key as keyof RowType<T>];
      }
    }
    
    return rawData as RowType<T>;
  }
}

export class Table<T extends Modal> {
  name: string
  modal: T
  private db: Database

  constructor(name: string, modal: T, db: Database) {
    this.name = name
    this.modal = modal
    this.db = db
  }

  create = () => {
    const columnDefs = Object.entries(this.modal).map(([col, type]) => `${col} ${type === 'INTEGER' ? 'INTEGER' : 'TEXT'} NOT NULL`).join(', ');
    this.db.run(`CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs})`);
  }

  add = (row: RowType<T>) => {
    const columns = Object.keys(this.modal)
    const placeholders = columns.map(() => '?').join(', ')
    const values = columns.map(col => {
      const value = row[col as keyof typeof row]
      if (this.modal[col] === 'HEX' && typeof value === 'string') return value.toString()
      return value
    })

    const sql = `INSERT INTO ${this.name} (${columns.join(', ')}) VALUES (${placeholders})`
    return this.db.run(sql, values)
  }

  get = (options?: GetOptions<T>): Row<T>[] => {
    let query = `SELECT * FROM ${this.name}`;
    const params: (string | number)[] = [];

    // Process WHERE clause
    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = Object.entries(options.where)
        .filter(([key]) => key in this.modal)
        .map(([key, value]) => {
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
          .filter(order => order.column in this.modal)
          .map(order => `${String(order.column)} ${order.direction || 'ASC'}`)
          .join(', ');
          
        if (orderByStatements) query += ` ORDER BY ${orderByStatements}`;
      }
    }
    
    // Process LIMIT clause
    if (options?.limit !== undefined && options.limit > 0) {
      query += ` LIMIT ${options.limit}`;
    }
    
    return this.db.query(query).as(Row<T>).all(...params);
  }

  delete = (partialRow?: Partial<RowType<T>>): void => {
    let query = `DELETE FROM ${this.name}`;
    
    const params: SQLQueryBindings[] = [];

    if (partialRow && Object.keys(partialRow).length > 0) {
      const conditions = Object.entries(partialRow)
        .filter(([key]) => key in this.modal)
        .map(([key, value]) => {
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
        .filter(([key]) => key in this.modal)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
        
      if (conditions) query += ` WHERE ${conditions}`;
    }
    
    const result = this.db.query(query).get(...params) as object;
    return result && 'count' in result ? (result.count as number) : 0;
  }

  update = (partialRow: Partial<RowType<T>>, whereClause: Partial<RowType<T>>) => {
    if (!partialRow || Object.keys(partialRow).length === 0) {
      throw new Error('Update requires at least one field to update');
    }
    
    if (!whereClause || Object.keys(whereClause).length === 0) {
      throw new Error('Update requires a where clause to identify rows');
    }
    
    const updateFields = Object.entries(partialRow)
      .filter(([key]) => key in this.modal)
      .map(([key]) => `${key} = ?`)
      .join(', ');
      
    const whereFields = Object.entries(whereClause)
      .filter(([key]) => key in this.modal)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    
    if (!updateFields || !whereFields) {
      throw new Error('Invalid update or where clause fields');
    }
    
    const query = `UPDATE ${this.name} SET ${updateFields} WHERE ${whereFields}`;
    
    const updateValues = Object.entries(partialRow)
      .filter(([key]) => key in this.modal)
      .map(([_, value]) => {
        if (typeof value === 'string' && value.startsWith('0x')) return value.toString();
        return value;
      });
      
    const whereValues = Object.entries(whereClause)
      .filter(([key]) => key in this.modal)
      .map(([_, value]) => {
        if (typeof value === 'string' && value.startsWith('0x')) return value.toString();
        return value;
      });
    
    const params = [...updateValues, ...whereValues];
    
    const stmt = this.db.prepare(query)
    return stmt.run(...params);
  }
}
