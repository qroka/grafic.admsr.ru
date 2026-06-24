import { onScopeDispose, ref, type Ref } from 'vue'

const DRAG_THRESHOLD_PX = 4

export function useDragScroll(container: Ref<HTMLElement | null>) {
  const isDragging = ref(false)
  const suppressClick = ref(false)

  let pointerActive = false
  let startX = 0
  let startScrollLeft = 0

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element))
      return false
    return Boolean(target.closest(
      'button, a, input, textarea, select, [role="button"], [data-no-drag-scroll]',
    ))
  }

  function onMouseMove(e: MouseEvent) {
    const el = container.value
    if (!pointerActive || !el)
      return

    const dx = e.pageX - startX
    if (!isDragging.value && Math.abs(dx) < DRAG_THRESHOLD_PX)
      return

    if (!isDragging.value) {
      isDragging.value = true
      suppressClick.value = true
    }

    e.preventDefault()
    el.scrollLeft = startScrollLeft - dx
  }

  function onMouseUp() {
    pointerActive = false
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    if (suppressClick.value) {
      window.setTimeout(() => {
        suppressClick.value = false
      }, 0)
    }
  }

  function onMouseDown(e: MouseEvent) {
    const el = container.value
    if (!el || e.button !== 0 || isInteractiveTarget(e.target))
      return

    pointerActive = true
    isDragging.value = false
    startX = e.pageX
    startScrollLeft = el.scrollLeft
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  onScopeDispose(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    isDragging,
    suppressClick,
    onMouseDown,
  }
}
