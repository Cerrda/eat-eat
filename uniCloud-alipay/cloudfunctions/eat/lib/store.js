const crypto = require('node:crypto')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function match(row, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (expected && typeof expected === 'object') {
      if (Array.isArray(expected.$in))
        return expected.$in.includes(row[key])
      if (typeof expected.$contains === 'string')
        return String(row[key] ?? '').includes(expected.$contains)
    }
    return row[key] === expected
  })
}

function sortValue(row, item) {
  if (item.rank)
    return item.rank[row[item.field]] ?? 0
  const value = row[item.field]
  return value == null ? 0 : value
}

function compareRows(order, left, right) {
  for (const item of order) {
    const a = sortValue(left, item)
    const b = sortValue(right, item)
    if (a < b)
      return item.dir === 'desc' ? 1 : -1
    if (a > b)
      return item.dir === 'desc' ? -1 : 1
  }
  return 0
}

function matched(rows, where) {
  return rows.filter(row => match(row, where || {}))
}

function project(row, fields) {
  const copy = clone(row)
  if (!fields)
    return copy
  const next = {}
  if (copy._id != null)
    next._id = copy._id
  for (const [key, on] of Object.entries(fields)) {
    if (on && copy[key] !== undefined)
      next[key] = copy[key]
  }
  return next
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
    async count(name, where = {}) {
      return matched(rows(name), where).length
    },
    async select(name, spec = {}) {
      const where = spec.where || {}
      const order = spec.order || []
      const skip = spec.skip || 0
      const limit = spec.limit == null ? 10 : spec.limit
      const list = matched(rows(name), where)
      if (order.length)
        list.sort((left, right) => compareRows(order, left, right))
      return list.slice(skip, skip + limit).map(row => project(row, spec.fields))
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileWhere(db, query) {
  const command = db.command
  const where = {}
  for (const [key, expected] of Object.entries(query || {})) {
    if (expected && typeof expected === 'object' && Array.isArray(expected.$in))
      where[key] = command.in(expected.$in)
    else if (expected && typeof expected === 'object' && typeof expected.$contains === 'string')
      where[key] = typeof db.RegExp === 'function'
        ? db.RegExp({ regexp: escapeRegExp(expected.$contains), options: '' })
        : new RegExp(escapeRegExp(expected.$contains))
    else
      where[key] = expected
  }
  return where
}

async function selectRanked(db, name, where, order, skip, limit, ranked) {
  const $ = db.command.aggregate
  const branches = Object.entries(ranked.rank).map(([value, then]) => ({
    case: $.eq([`$${ranked.field}`, value]),
    then,
  }))
  const sort = {}
  for (const item of order)
    sort[item.rank ? 'slotRank' : item.field] = item.dir === 'desc' ? -1 : 1
  let pipeline = db.collection(name).aggregate()
    .match(where)
    .addFields({
      slotRank: $.switch({
        branches,
        default: 0,
      }),
    })
    .sort(sort)
  if (skip > 0)
    pipeline = pipeline.skip(skip)
  const res = await pipeline.limit(limit).end()
  return res.data || []
}

function createUniStore(db) {
  return {
    async find(name, query = {}, limit = 100) {
      const res = await db.collection(name).where(query).limit(limit).get()
      return res.data || []
    },
    async count(name, where = {}) {
      const res = await db.collection(name).where(compileWhere(db, where)).count()
      return res.total || 0
    },
    async select(name, spec = {}) {
      const where = compileWhere(db, spec.where || {})
      const order = spec.order || []
      const skip = spec.skip || 0
      const limit = spec.limit == null ? 10 : spec.limit
      const ranked = order.find(item => item.rank)
      if (ranked)
        return selectRanked(db, name, where, order, skip, limit, ranked)
      let query = db.collection(name).where(where)
      if (spec.fields)
        query = query.field(spec.fields)
      for (const item of order)
        query = query.orderBy(item.field, item.dir === 'desc' ? 'desc' : 'asc')
      if (skip > 0)
        query = query.skip(skip)
      const res = await query.limit(limit).get()
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
