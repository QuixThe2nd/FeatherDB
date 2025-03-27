# FeatherDB
FeatherDB is a lightweight TypeScript ORM built for Bun and the web. It is made to allow for custom advanced types in an SQLite database. [SQL.js](https://sql.js.org/#/) is used for web.

## 1. Installation

Run `bun add github:QuixThe2nd/FeatherDB`

## 2. SQLite

Import and start a SQLite database:

### Bun
```TS
import { Database } from 'bun:sqlite'

const db = new Database();
```

### Web
```TS
import initSqlJs from 'sql.js'

const db = new (await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` })).Database()
```

## 3. Define Table Schema

Define an interface for your table with types as strict as you like as well as your SQL table schema
```TS
import { type Definition } from "FeatherDB";

interface UserModal {
  id: number,
  first_name: string,
  last_name: string,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER' },
  first_name: { type: 'TEXT' },
  last_name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT' }
}
```

## 4. Create Row Class

Create a class that will be used to represent fetched rows:
```TS
class User implements UserModal {
  id!: number
  first_name!: string
  last_name!: string
  favourite_colour!: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
  [key: string]: any

  constructor(modal: UserModal) {
    Object.assign(this, modal)
  }

  // You can optionally add custom properties and method to this class.
  getFullName() {
    return `${this.first_name} ${this.last_name}`
  }
}
```

## 5. Create Table

Initialise a FeatherDB Table class and create the table:
```TS
import { Table } from "FeatherDB";

const users = new Table<UserModal, User>(db, 'user', userDefinition, User)
users.create()
```

## 6. Adding rows

```TS
users.add({
  id: 12,
  first_name: 'John',
  last_name: 'Smith',
  favourite_colour: 'blue'
})
```

## 7. Getting rows

```TS
const user = users.get({ where: { first_name: 'John', last_name: 'Smith' } })[0]
console.log(`${user.getFullName()} - ${user.id}`)
```

## 8. Counting rows

```TS
const count = users.count({ { where: { first_name: 'John' } })
console.log(`There are ${count} John's`)
```

## 9. Updating rows

```TS
users.update({ id }, { first_name: 'Tom' })
```

## 10. Deleting rows

```TS
users.delete({ id })
```

## Complete Example
```TS
/**** BUN ****/
import { Database } from 'bun:sqlite'
/**** WEB ****/
import initSqlJs from 'sql.js'

import { Table, type Definition } from "FeatherDB";

interface UserModal {
  id: number,
  first_name: string,
  last_name: string,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER' },
  first_name: { type: 'TEXT' },
  last_name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT' }
}

class User implements UserModal {
  id!: number
  first_name!: string
  last_name!: string
  favourite_colour!: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
  [key: string]: any

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

const user = users.get({ where: { first_name: 'John', last_name: 'Smith' } })[0]
if (user) {
  const id = user.id
  console.log(`${user.getFullName()} - ${id}`)

  const count = users.count({ where: { first_name: 'John' } })
  console.log(`There are ${count} John's`)

  users.update({ id }, { first_name: 'Tom' })
  users.delete({ id })
} else console.log('User not found')
```
