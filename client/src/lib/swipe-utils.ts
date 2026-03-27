const EDGE_SWIPE_ZONE_PX = 32;

export function shouldTrackEdgeSwipe(target: EventTarget | null, touchX: number) {
  const isNearEdge =
    touchX <= EDGE_SWIPE_ZONE_PX || touchX >= window.innerWidth - EDGE_SWIPE_ZONE_PX;

  if (!isNearEdge) {
    return false;
  }

  if (!(target instanceof Element)) {
    return true;
  }

  // Define interactive elements that should avoid swipe triggers
  return !target.closest(
    "button, a, input, textarea, select, [role='button'], [data-no-edge-swipe], [contenteditable='true']"
  );
}
