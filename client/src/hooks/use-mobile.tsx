import * as React from "react"

// Phone layout: narrow screens, plus phones held sideways and other short touch screens (foldable covers),
// which are wide but have no room for the desktop sidebar. Keep in step with the CSS phone queries.
export const PHONE_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
