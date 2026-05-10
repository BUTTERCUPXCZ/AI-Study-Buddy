import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Rate-limit countdown hook for the auth screens. Call `startCooldown(s)`
 * when the API returns 429 with a `retryAfter` payload; the hook ticks
 * `retryAfter` down to zero, flipping `isRateLimited` to false when the
 * window expires. UI uses these values to disable the submit button and
 * show "Wait Xs".
 */
export function useRateLimit() {
  const [retryAfter, setRetryAfter] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startCooldown = useCallback(
    (seconds: number) => {
      stop()
      setRetryAfter(seconds)
      intervalRef.current = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev <= 1) {
            stop()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return {
    isRateLimited: retryAfter > 0,
    retryAfter,
    startCooldown,
  }
}
