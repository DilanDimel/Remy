import * as React from "react"

// Phone layout: narrow screens, plus phones held sideways and other short touch screens (foldable covers),
// which are wide but have no room for the desktop sidebar. Keep in step with the CSS phone queries.
export const PHONE_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)"
// Between phone and desktop: open foldables (Galaxy Z Fold, Pixel Fold, iPhone Duo inside), small tablets, narrow windows.
// Pages that would squeeze a desktop layout use list-beside-detail here instead.
export const MID_QUERY = "(min-width: 768px) and (max-width: 1099px) and (min-height: 501px), (min-width: 768px) and (max-width: 1099px) and (pointer: fine)"

export function useMedia(query: string) {
  const [on, setOn] = React.useState(() => typeof window !== "undefined" && window.matchMedia(query).matches)
  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setOn(mql.matches)
    mql.addEventListener("change", onChange)
    setOn(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return on
}

export function useIsMobile() {
  return useMedia(PHONE_QUERY)
}
