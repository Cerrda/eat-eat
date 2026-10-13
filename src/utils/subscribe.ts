// 与云函数 eat/lib/wx.js 里的待办事项提醒模板一致。
const COOK_ORDER_TMPL_ID = 'mPUGhqYqc14rFMlWoUplbbKPxmoOnhAj8SVRTIb5gwc'

export type SubscribeChoice = 'accept' | 'reject' | 'ban' | 'fail'

interface SubscriptionsSetting {
  mainSwitch?: boolean
  itemSettings?: Record<string, string>
}

let alwaysAccept = false
let renewed = false

export function askCookRemind(): Promise<SubscribeChoice> {
  return new Promise((resolve) => {
    uni.requestSubscribeMessage({
      tmplIds: [COOK_ORDER_TMPL_ID],
      success(res) {
        const choice = res[COOK_ORDER_TMPL_ID]
        if (choice === 'accept' || choice === 'reject' || choice === 'ban')
          resolve(choice)
        else
          resolve('fail')
      },
      fail() {
        resolve('fail')
      },
    })
  })
}

function readCookRemindAlways(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.getSetting({
      withSubscriptions: true,
      success(res) {
        const sub = (res as { subscriptionsSetting?: SubscriptionsSetting }).subscriptionsSetting
        const choice = sub?.itemSettings?.[COOK_ORDER_TMPL_ID]
        resolve(Boolean(sub?.mainSwitch) && choice === 'accept')
      },
      fail() {
        resolve(false)
      },
    })
  })
}

export async function loadCookRemindAlways(): Promise<boolean> {
  alwaysAccept = await readCookRemindAlways()
  renewed = false
  return alwaysAccept
}

export function renewCookRemindIfAlways(): Promise<boolean | null> {
  if (!alwaysAccept || renewed)
    return Promise.resolve(null)
  renewed = true
  return askCookRemind().then(async (choice) => {
    if (choice === 'accept')
      return true
    alwaysAccept = await readCookRemindAlways()
    renewed = false
    return alwaysAccept
  })
}
