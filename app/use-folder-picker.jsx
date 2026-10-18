"use client";
import { useEffect, useRef, useState } from "react";

export default function useFolderPicker(api, onSelected, onError) {
  const active = useRef(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => () => active.current?.abort(), []);
  function cancel() {
    active.current?.abort();
    active.current = null;
    setPicking(false);
  }
  async function pick() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPicking(true);
    onError("");
    try {
      const result = await api("vault/pick", {}, "POST", controller.signal);
      if (!controller.signal.aborted && result.path) onSelected(result.path);
    } catch (error) {
      if (!controller.signal.aborted) onError(error.message);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPicking(false);
      }
    }
  }
  return { picking, pick, cancel };
}
