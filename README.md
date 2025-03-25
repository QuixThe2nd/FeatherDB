# FeatherDB
FeatherDB is a lightweight TypeScript ORM built for Bun.

1. Installation

Run `bun add github:QuixThe2nd/FeatherDB`

2. Start SQLite
```TS
import { Database } from 'bun:sqlite'

const db = new Database();
```

3. Define Table
```TS
import { type Modal } from "FeatherDB";

interface UserModal extends Modal {
  id: 'INTEGER',
  name: 'STRING',
}

const users = new Table<UserModal>('user', {id: 'INTEGER', name: 'STRING'}, db)
users.create()
```

4. Adding rows
```TS
users.add({
  id: 12,
  name: 'John Smith'
})
```

5. Getting rows
```TS
const result1 = users.select({ name: 'John Smith' })
console.log('ID: ', result1[0].get(id))

const result2 = users.select({ id: 12 })
console.log('Name: ', result2[0].name)
```
