const crypto = require('node:crypto')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function match(row, query) {
  return Object.entries(query).every(([key, expected]) => row[key] === expected)
}

function assertQuery(query) {
  if (!query || Object.keys(query).length === 0)
    throw new Error('查询条件是空的')
}

function createMemoryStore() {
  const tables = {}

  function rows(name) {
    if (!tables[name])
      tables[name] = []
    return tables[name]
  }

  return {
    async find(name, query = {}, limit = 100) {
      return rows(name).filter(row => match(row, query)).slice(0, limit).map(clone)
    },
    async insert(name, doc) {
      const row = {
        ...clone(doc),
        _id: crypto.randomBytes(12).toString('hex'),
      }
      rows(name).push(row)
      return row._id
    },
    async update(name, query, patch) {
      assertQuery(query)
      let updated = 0
      for (const row of rows(name)) {
        if (!match(row, query))
          continue
        Object.assign(row, clone(patch))
        updated += 1
      }
      return updated
    },
    async remove(name, query) {
      assertQuery(query)
      const list = rows(name)
      const kept = list.filter(row => !match(row, query))
      const deleted = list.length - kept.length
      tables[name] = kept
      return deleted
    },
  }
}

function createUniStore(db) {
  return {
    async find(name, query = {}, limit = 100) {
      const res = await db.collection(name).where(query).limit(limit).get()
      return res.data || []
    },
    async insert(name, doc) {
      const res = await db.collection(name).add(doc)
      return res.id
    },
    async update(name, query, patch) {
      assertQuery(query)
      const res = await db.collection(name).where(query).update(patch)
      return res.updated ?? res.affectedDocs ?? 0
    },
    async remove(name, query) {
      assertQuery(query)
      const res = await db.collection(name).where(query).remove()
      return res.deleted ?? res.affectedDocs ?? 0
    },
  }
}

module.exports = {
  createMemoryStore,
  createUniStore,
}
