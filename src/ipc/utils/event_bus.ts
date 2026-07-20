type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

export function on(channel: string, listener: Listener): () => void {
  if (!listeners.has(channel)) {
    listeners.set(channel, new Set());
  }
  listeners.get(channel)!.add(listener);
  return () => {
    listeners.get(channel)?.delete(listener);
  };
}

export function emit(channel: string, payload: unknown): void {
  listeners.get(channel)?.forEach((fn) => fn(payload));
}
