export interface CloudSuccess<T> {
  errCode: 0
  errMsg: string
  data: T
}

export interface EatPingData {
  ok: true
  now: number
}

export interface EatCloud {
  ping: () => Promise<CloudSuccess<EatPingData>>
}

/** 导入 eat 云对象。凭证来自 .env.unicloud.local，或由 HBuilderX 关联服务空间后注入。 */
export function eatCloud() {
  return uniCloud.importObject('eat', {
    customUI: true,
  }) as EatCloud
}
