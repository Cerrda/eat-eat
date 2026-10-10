import { EatRequestError } from '@/api/eat'
import { currentPage, pageRoute, showHint } from '@/utils/hint'

export function errorMessage(err: unknown) {
  return err instanceof EatRequestError ? err.message : '这次没有完成，再试一次'
}

export function showError(err: unknown) {
  const message = errorMessage(err)
  if (textSize(message) > 14) {
    void tell('没有完成', message)
    return
  }
  showHint(message)
}

export function tell(title: string, content: string, confirmText = '知道了') {
  return openDialog({
    title,
    content,
    confirmText,
    cancelText: '',
    showCancel: false,
    editable: false,
    placeholder: '',
    draft: '',
  }).then(result => result.confirm)
}

export function ask(title: string, content: string, confirmText = '确定') {
  return openDialog({
    title,
    content,
    confirmText,
    cancelText: '先不用',
    showCancel: true,
    editable: false,
    placeholder: '',
    draft: '',
  }).then(result => result.confirm)
}

export function askText(title: string, placeholder: string, current = '') {
  return openDialog({
    title,
    content: '',
    confirmText: '确定',
    cancelText: '先不用',
    showCancel: true,
    editable: true,
    placeholder,
    draft: current,
  }).then(result => (result.confirm ? result.content : null))
}

export interface DialogResult {
  confirm: boolean
  content: string
}

interface DialogInput {
  title: string
  content: string
  confirmText: string
  cancelText: string
  showCancel: boolean
  editable: boolean
  placeholder: string
  draft: string
}

interface DialogState {
  open: Ref<boolean>
  seq: Ref<number>
  route: Ref<string>
  title: Ref<string>
  content: Ref<string>
  confirmText: Ref<string>
  cancelText: Ref<string>
  showCancel: Ref<boolean>
  editable: Ref<boolean>
  placeholder: Ref<string>
  draft: Ref<string>
  pendingConfirm: boolean
  resolver?: (result: DialogResult) => void
  timer?: ReturnType<typeof setTimeout>
}

function dialogState(): DialogState {
  const host = globalThis as typeof globalThis & { __eatDialog?: DialogState }
  if (!host.__eatDialog) {
    host.__eatDialog = {
      open: ref(false),
      seq: ref(0),
      route: ref(''),
      title: ref(''),
      content: ref(''),
      confirmText: ref(''),
      cancelText: ref(''),
      showCancel: ref(false),
      editable: ref(false),
      placeholder: ref(''),
      draft: ref(''),
      pendingConfirm: false,
    }
  }
  return host.__eatDialog
}

export function useDialog() {
  const state = dialogState()
  return {
    dialogOpen: state.open,
    dialogSeq: state.seq,
    dialogRoute: state.route,
    dialogTitle: state.title,
    dialogContent: state.content,
    dialogConfirmText: state.confirmText,
    dialogCancelText: state.cancelText,
    dialogShowCancel: state.showCancel,
    dialogEditable: state.editable,
    dialogPlaceholder: state.placeholder,
    dialogDraft: state.draft,
  }
}

function openDialog(input: DialogInput) {
  const state = dialogState()
  if (state.resolver)
    settleDialog()
  state.title.value = input.title
  state.content.value = input.content
  state.confirmText.value = input.confirmText
  state.cancelText.value = input.cancelText
  state.showCancel.value = input.showCancel
  state.editable.value = input.editable
  state.placeholder.value = input.placeholder
  state.draft.value = input.draft
  state.pendingConfirm = false
  state.route.value = pageRoute(currentPage())
  state.seq.value += 1
  state.open.value = true
  return new Promise<DialogResult>((resolve) => {
    state.resolver = resolve
  })
}

export function beginClose(confirm: boolean) {
  const state = dialogState()
  if (!state.open.value || !state.resolver)
    return
  state.pendingConfirm = confirm
  state.open.value = false
  if (state.timer)
    clearTimeout(state.timer)
  state.timer = setTimeout(() => settleDialog(), 320)
}

export function dismissDialog() {
  const state = dialogState()
  if (!state.resolver)
    return
  if (state.open.value)
    state.pendingConfirm = false
  settleDialog()
}

export function settleDialog() {
  const state = dialogState()
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = undefined
  }
  const resolve = state.resolver
  if (!resolve)
    return
  state.resolver = undefined
  state.open.value = false
  resolve({ confirm: state.pendingConfirm, content: state.draft.value })
}

function textSize(value: string) {
  return Array.from(value).length
}
