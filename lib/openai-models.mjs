import { compatibleModels } from "../public/ai-models.js";
export async function listAllowedModels(key, fetcher = fetch) {
  if (!key) return [];
  const response = await fetcher("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      response.status === 401
        ? "OpenAI rejected this key."
        : response.status === 403
          ? "This key cannot list models. Check its model permissions."
          : `Unable to check OpenAI models (${response.status}).`,
    );
  const result = await response.json();
  return compatibleModels((result.data || []).map((m) => m.id));
}
