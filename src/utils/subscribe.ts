// 与云函数 eat/lib/wx.js 里的模板一致。
// 待办事项提醒：新订单发给做饭端。
const COOK_ORDER_TMPL_ID = 'mPUGhqYqc14rFMlWoUplbbKPxmoOnhAj8SVRTIb5gwc'
// 回家吃饭提醒：接单后发给点餐端。
const EATER_MEAL_TMPL_ID = 'pkY6F08kud8HZI6GPZfRH-X9txb_udMdm1CrtDuXA7I'

export type SubscribeChoice = 'accept' | 'reject' | 'ban' | 'fail'

interface SubscriptionsSetting {
  mainSwitch?: boolean
  itemSettings?: Record<string, string>
}

let alwaysAccept = false
let renewed = false

function askSubscribe(tmplId: string): Promise<SubscribeChoice> {
  return new Promise((resolve) => {
    uni.requestSubscribeMessage({
      tmplIds: [tmplId],
      success(res) {
        const choice = (res as unknown as Record<string, string>)[tmplId]
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

export function askCookRemind(): Promise<SubscribeChoice> {
  return askSubscribe(COOK_ORDER_TMPL_ID)
}

// 每次下单都调用一次：勾过「总是保持」后不再弹窗，但每次调用才会得到一条发送额度。
export function askEaterRemind(): Promise<SubscribeChoice> {
  return askSubscribe(EATER_MEAL_TMPL_ID)
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
