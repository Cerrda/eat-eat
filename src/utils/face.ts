const SERIF = ' -./0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz、。「」一上下不个中为久之也书了交人今介从代以份会传但位你信倒做先入全兰册再写凉出分切列删别到制功加动午单厨去及友发取句另只可吃同名后呼和品回图在块填增备复多天头好嫩字完定家对封小少展己已常并开弃张归录待很得微情想成我或房才打找把抖拌拍拒择拿挂换掉排接搜摆摊撒收改放效散文断新方日早时明是晚暂替最月有期未材条来架查标样核次正步水汁汤没油法注消源炒点烧照片独现理生用留番登的盐盛相看真着知码确神称空端笔等简管类糖红经绑给络绝编缺网置羹翻能自至花茄菜葱蒜蒸蓉蛋行补表西要解订认记设试话详请读谁象起跟身转软载辑输边过还这进连选道邀那部里重链错间除面音项食餐饭香马骤骨鸡，：？'
const SANS = ' -./0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·‹›✓、。「」一上下不个中为久之也书了交人今介从代以份会传但位你信倒做先入全兰册再写凉出分切列删别到制功加动午单厨去及友发取句另只可吃同名后呼和品回图在块填增备复多天头好嫩字完定家对封小少展己已常并开弃张归录待很得微情想成我或房才打找把抖拌拍拒择拿挂换掉排接搜摆摊撒收改放效散文断新方日早时明是晚暂替最月有期未材条来架查标样核次正步水汁汤没油法注消源炒点烧照片独现理生用留番登的盐盛相看真着知码确神称空端笔等简管类糖红经绑给络绝编缺网置羹翻能自至花茄菜葱蒜蒸蓉蛋行补表西要解订认记设试话详请读谁象起跟身转软载辑输边过还这进连选道邀那部里重链错间除面音项食餐饭香马骤骨鸡，：？'
const MONO = ' -./0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz、。「」一上下不个中为久之也书了交人今介从代以份会传但位你信倒做先入全兰册再写凉出分切列删别到制功加动午单厨去及友发取句另只可吃同名后呼和品回图在块填增备复多天头好嫩字完定家对封小少展己已常并开弃张归录待很得微情想成我或房才打找把抖拌拍拒择拿挂换掉排接搜摆摊撒收改放效散文断新方日早时明是晚暂替最月有期未材条来架查标样核次正步水汁汤没油法注消源炒点烧照片独现理生用留番登的盐盛相看真着知码确神称空端笔等简管类糖红经绑给络绝编缺网置羹翻能自至花茄菜葱蒜蒸蓉蛋行补表西要解订认记设试话详请读谁象起跟身转软载辑输边过还这进连选道邀那部里重链错间除面音项食餐饭香马骤骨鸡，：？'

const ROLE = {
  serif: 'font-display',
  sans: 'font-body',
  mono: 'font-mono',
} as const

export type FaceRole = keyof typeof ROLE

function covered(text: string, glyphs: string) {
  let seen = false
  for (const char of text) {
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t')
      continue
    seen = true
    if (!glyphs.includes(char))
      return false
  }
  return seen
}

export function faceOf(text: string, role: FaceRole) {
  const glyphs = role === 'serif' ? SERIF : role === 'sans' ? SANS : MONO
  return covered(text || '', glyphs) ? ROLE[role] : ''
}
