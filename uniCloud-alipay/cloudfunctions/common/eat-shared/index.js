function ok(data) {
  return {
    errCode: 0,
    errMsg: 'ok',
    data,
  }
}

function fail(errCode, errMsg, data) {
  const body = {
    errCode,
    errMsg,
  }
  if (data !== undefined)
    body.data = data
  return body
}

module.exports = {
  ok,
  fail,
}
