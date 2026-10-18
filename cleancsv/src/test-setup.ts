import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// jsdom does not implement scrolling; the app treats it as optional.
window.scrollTo = () => {}
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {
    // storage unavailable in this environment
  }
})
