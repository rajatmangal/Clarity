import { randomUUID } from "node:crypto";
export const isDesktop = () => process.env.CLARITY_DESKTOP === "1";
export function desktopCall(action, value) {
  if (!isDesktop() || !process.parentPort)
    throw Error("Desktop services are unavailable.");
  const bridge = (globalThis.__clarityDesktopBridge ||= {
    pending: new Map(),
    listening: false,
  });
  if (!bridge.listening) {
    process.parentPort.on("message", ({ data }) => {
      if (data?.type !== "clarity-response") return;
      const pending = bridge.pending.get(data.id);
      if (!pending) return;
      bridge.pending.delete(data.id);
      clearTimeout(pending.timer);
      if (data.error) pending.reject(Error(data.error));
      else pending.resolve(data.value);
    });
    bridge.listening = true;
  }
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      bridge.pending.delete(id);
      reject(Error("Desktop request timed out. Please try again."));
    }, 120000);
    bridge.pending.set(id, { resolve, reject, timer });
    process.parentPort.postMessage({
      type: "clarity-request",
      id,
      action,
      value,
    });
  });
}
