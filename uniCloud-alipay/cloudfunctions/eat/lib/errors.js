class EatError extends Error {
  constructor(errCode, errMsg, data) {
    super(errMsg)
    this.name = 'EatError'
    this.errCode = errCode
    this.errMsg = errMsg
    this.data = data
    this.eat = true
  }
}

module.exports = {
  EatError,
}
