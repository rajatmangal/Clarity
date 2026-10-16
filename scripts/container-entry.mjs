if (!process.env.CLARITY_PASSWORD || !process.env.CLARITY_ORIGIN)
  throw Error(
    "Set CLARITY_PASSWORD and CLARITY_ORIGIN before starting the server.",
  );
await import("./server.js");
