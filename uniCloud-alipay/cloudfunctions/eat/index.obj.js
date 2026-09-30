const { ok } = require('eat-shared')

module.exports = {
  async ping() {
    return ok({
      ok: true,
      now: Date.now(),
    })
  },
}
