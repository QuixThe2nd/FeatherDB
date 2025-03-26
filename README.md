# FeatherDB
FeatherDB is a lightweight TypeScript ORM built for Bun. It is made to allow for custom advanced types in an SQLite database.

1. Installation

Run `bun add github:QuixThe2nd/FeatherDB`

2. Start SQLite
```TS
import { Database } from 'bun:sqlite'

const db = new Database();
```

3. Define Table
```TS
import { Table, type Modal } from "FeatherDB";

interface UserModal extends Modal {
  id: number,
  name: string,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const users = new Table<UserModal>('user', { id: { type: 'INTEGER' }, name: { type: 'TEXT' }, favourite_colour: { type: 'TEXT' } }, db)
users.create()
```

4. Adding rows
```TS
users.add({
  id: 12,
  name: 'John Smith',
  favourite_colour: 'blue'
})
```

5. Getting rows
```TS
const user = users.get({ where: { name: 'John Smith' } })[0]
console.log('ID: ', user?.get('id') ?? "User doesn't exist")
```

6. Deleting rows
```TS
users.delete({ name: 'John Smith' })
```

## Complete Example
```TS
import { Database } from 'bun:sqlite'
import { Table, type Modal } from "FeatherDB";

interface UserModal extends Modal {
  id: number,
  name: string,
  favourite_colour: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'purple'
}

const db = new Database();
const users = new Table<UserModal>('user', { id: { type: 'INTEGER' }, name: { type: 'TEXT' }, favourite_colour: { type: 'TEXT' } }, db)
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
