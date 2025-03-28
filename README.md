# FeatherDB
FeatherDB is a lightweight TypeScript ORM built for Bun and the web. It is made to allow for custom advanced types in an SQLite database. [SQL.js](https://sql.js.org/#/) is used for web.

## Guide

### 1. Installation

Run `bun add github:QuixThe2nd/FeatherDB`

### 2. SQLite

Import and start a SQLite database:

#### Bun
```TS
import { Database } from 'bun:sqlite'

const db = new Database();
```

#### Web
```TS
import initSqlJs from 'sql.js'

const db = new (await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` })).Database()
```

### 3. Define Table Schema

Define an interface for your table with types as strict as you like as well as your SQL table schema
```TS
import { type Definition } from "FeatherDB";

interface UserModal {
  id: number,
  first_name: string,
  last_name: string,
  favourite_colour: null | 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER', primaryKey: true },
  first_name: { type: 'TEXT' },
  last_name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT', nullable: true }
}
```

### 4. Create Row Class

Create a class that will be used to represent fetched rows:
```TS
class User implements UserModal {
  id!: number
  first_name!: string
  last_name!: string
  favourite_colour!: null | 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'

  constructor(modal: UserModal) {
    Object.assign(this, modal)
  }

  // You can optionally add custom properties and methods to this class.
  getFullName() {
    return `${this.first_name} ${this.last_name}`
  }
}
```

### 5. Create Table

Initialise a FeatherDB Table class and create the table:
```TS
import { Table } from "FeatherDB";

const users = new Table<UserModal, User>(db, 'user', userDefinition, User)
users.create()
```

### 6. Adding rows

```TS
users.add({
  id: 12,
  first_name: 'John',
  last_name: 'Smith',
  favourite_colour: 'blue'
})
```

### 7. Getting rows

```TS
import { eq } from "FeatherDB";

const user = users.get({ where: [{ column: 'first_name', opt: eq('John') }, { column: 'last_name', opt: eq('Smith') }], limit: 1 })[0]
console.log(`${user.getFullName()} - ${user.id}`)
```

### 8. Counting rows

```TS
const count = users.count([{ column: 'first_name', opt: eq('John') }])
console.log(`There are ${count} John's`)
```

### 9. Updating rows

```TS
users.update({ first_name: 'Tom' }, { where: [{ column: 'id', opt: eq(id) }] })
```

### 10. Deleting rows

```TS
users.delete({ where: [{ column: 'id', opt: eq(id) }] })
```

### Complete Example
```TS
/**** BUN ****/
import { Database } from 'bun:sqlite'
/**** WEB ****/
import initSqlJs from 'sql.js'

import { Table, eq, type Definition } from "FeatherDB";

interface UserModal {
  id: number,
  first_name: string,
  last_name: string,
  favourite_colour: null | 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER', primaryKey: true },
  first_name: { type: 'TEXT' },
  last_name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT', nullable: true }
}

class User implements UserModal {
  id!: number
  first_name!: string
  last_name!: string
  favourite_colour!: null | 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'

  constructor(modal: UserModal) {
    Object.assign(this, modal)
  }

  getFullName() {
    return `${this.first_name} ${this.last_name}`
  }
}

/**** BUN ****/
const db = new Database();
/**** WEB ****/
const db = new (await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` })).Database()

const users = new Table<UserModal, User>(db, 'user', userDefinition, User)
users.create()

users.add({
  id: 12,
  first_name: 'John',
  last_name: 'Smith',
  favourite_colour: 'blue'
})

const user = users.get({ where: [{ column: 'first_name', opt: eq('John') }, { column: 'last_name', opt: eq('Smith') }], limit: 1 })[0]
if (user) {
  const id = user.id
  console.log(`${user.getFullName()} - ${id}`)

  const count = users.count([{ column: 'first_name', opt: eq('John') }])
  console.log(`There are ${count} John's`)

  users.update({ first_name: 'Tom' }, { where: [{ column: 'id', opt: eq(id) }] })
  users.delete({ where: [{ column: 'id', opt: eq(id) }] })
} else console.log('User not found')
```

## Operators
Operators are defined like so:
```TS
{ where: { first_name: eq('John') } }
```

### Available Operators
```TS
import { eq, ne, gt, lt, ge, le } from "FeatherDB";
```
- `=`: `eq()`
- `!=`: `ne()`
- `>`: `gt()`
- `<`: `lt()`
- `>=`: `ge()`
- `<=`: `le()`
