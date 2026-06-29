import { onScopeDispose, watchEffect, type Ref } from 'vue'

function isVerticallyScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el)
  const overflowY = style.overflowY
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay')
    return false
  return el.scrollHeight > el.clientHeight
}

function canScrollVertically(el: HTMLElement, deltaY: number): boolean {
  if (!isVerticallyScrollable(el))
    return false
  if (deltaY < 0)
    return el.scrollTop > 0
  if (deltaY > 0)
    return el.scrollTop + el.clientHeight < el.scrollHeight
  return false
}

function findVerticalScrollContainer(
  target: Element | null,
  boundary: HTMLElement,
): HTMLElement | null {
  let node = target
  while (node && node !== boundary) {
    if (node instanceof HTMLElement && isVerticallyScrollable(node))
      return node
    node = node.parentElement
  }
  return null
}

/** Вертикальное колесо → горизонтальный скролл (как на канбан-доске). */
export function useWheelHorizontalScroll(container: Ref<HTMLElement | null>) {
  function onWheel(e: WheelEvent) {
    const el = container.value
    if (!el)
      return

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY))
      return

    if (e.deltaY === 0)
      return

    const target = e.target instanceof Element ? e.target : null
    const verticalScroller = findVerticalScrollContainer(target, el)

    if (verticalScroller) {
      if (canScrollVertically(verticalScroller, e.deltaY))
        return
      // Внутри колонки дня на границе — не отдаём скролл странице.
      e.preventDefault()
      return
    }

    const maxScrollLeft = el.scrollWidth - el.clientWidth
    if (maxScrollLeft <= 0)
      return

    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  const stop = watchEffect((onCleanup) => {
    const el = container.value
    if (!el)
      return
    el.addEventListener('wheel', onWheel, { passive: false })
    onCleanup(() => el.removeEventListener('wheel', onWheel))
  })

  onScopeDispose(stop)
}
