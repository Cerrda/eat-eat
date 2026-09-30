function ok(data) {
  return {
    errCode: 0,
    errMsg: 'ok',
    data,
  }
}

function fail(errCode, errMsg) {
  return {
    errCode,
    errMsg,
  }
}

module.exports = {
  ok,
  fail,
}
