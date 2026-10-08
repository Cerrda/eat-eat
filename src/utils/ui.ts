import { EatRequestError } from '@/api/eat'

export function errorMessage(err: unknown) {
  return err instanceof EatRequestError ? err.message : '这次没有完成，再试一次'
}

export function showError(err: unknown) {
  const message = errorMessage(err)
  if (textSize(message) > 14) {
    uni.showModal({
      title: '没有完成',
      content: message,
      showCancel: false,
      confirmText: '知道了',
    })
    return
  }
  uni.showToast({ title: message, icon: 'none' })
}

export function ask(title: string, content: string, confirmText = '确定') {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      cancelText: '先不用',
      success: result => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    })
  })
}

export function askText(title: string, placeholder: string, current = '') {
  return new Promise<string | null>((resolve) => {
    uni.showModal({
      title,
      content: current,
      editable: true,
      placeholderText: placeholder,
      confirmText: '确定',
      cancelText: '先不用',
      success: (result) => {
        if (!result.confirm) {
          resolve(null)
          return
        }
        const typed = result as { content?: string }
        resolve(String(typed.content || ''))
      },
      fail: () => resolve(null),
    })
  })
}

function textSize(value: string) {
  return Array.from(value).length
}
