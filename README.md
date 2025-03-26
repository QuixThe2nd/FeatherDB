# FeatherDB
FeatherDB is a lightweight TypeScript ORM built for Bun. It is made to allow for custom advanced types in an SQLite database.

1. Installation

Run `bun add github:QuixThe2nd/FeatherDB`

2. SQLite
Import and start a SQLite database:
```TS
import { Database } from 'bun:sqlite'

const db = new Database();
```

3. Define Table Schema
Define an interface for your table with types as strict as you like:
```TS
import { type Modal } from "FeatherDB";

interface UserModal extends Modal {
  id: number,
  name: `${string} ${string}`,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}
```

Then define your SQL schema:
```TS
import { type Definition } from "FeatherDB";

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER' },
  name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT', nullable: true }
}
```

4. Create Row Class
Create a class that will be used to represent fetched rows:
```TS
class User implements UserModal {
  id!: number
  name!: string
  favourite_colour!: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
  [key: string]: any

  constructor(modal: UserModal) {
    Object.assign(this, modal)
  }
}
```

You can optionally add custom properties and method to this cals.

5. Create Table
Initialise a FeatherDB Table class and create the table:
```TS
import { Table } from "FeatherDB";

const users = new Table<UserModal>(db, 'user', userDefinition, User)
users.create()
```

6. Adding rows
```TS
users.add({
  id: 12,
  name: 'John Smith',
  favourite_colour: 'blue'
})
```

7. Getting rows
```TS
const user = users.get({ where: { name: 'John Smith' } })[0]
console.log('ID: ', user?.get('id') ?? "User doesn't exist")
```

8. Deleting rows
```TS
users.delete({ name: 'John Smith' })
```

## Complete Example
```TS
import { Database } from 'bun:sqlite'
import { Table, type Definition, type Modal } from "FeatherDB";

interface UserModal extends Modal {
  id: number,
  name: string,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const userDefinition: Definition<UserModal> = {
  id: { type: 'INTEGER' },
  name: { type: 'TEXT' },
  favourite_colour: { type: 'TEXT' }
}

class User implements UserModal {
  id!: number
  name!: string
  favourite_colour!: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
  [key: string]: any

  constructor(modal: UserModal) {
    Object.assign(this, modal)
  }
}

const db = new Database();
const users = new Table<UserModal>(db, 'user', userDefinition, User)
users.create()

users.add({
  id: 12,
  name: 'John Smith',
  favourite_colour: 'blue'
})

const user = users.get({ where: { name: 'John Smith' } })[0]
console.log('ID: ', user?.get('id') ?? "User doesn't exist")

users.delete({ name: 'John Smith' })
```
