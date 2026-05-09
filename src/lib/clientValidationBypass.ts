import { createSignal } from 'solid-js'

const [isClientValidationBypassed, setClientValidationBypassed] = createSignal(false)

export { isClientValidationBypassed, setClientValidationBypassed }

export function toggleClientValidationBypass() {
  setClientValidationBypassed((v) => !v)
}
