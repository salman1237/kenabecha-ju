const CART_CHANGED_EVENT = "cart:changed";

export function emitCartChanged() {
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export function onCartChanged(handler: () => void) {
  window.addEventListener(CART_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CART_CHANGED_EVENT, handler);
}
