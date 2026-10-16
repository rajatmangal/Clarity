// Text models verified for Responses + structured output. Availability is intersected with /v1/models.
export const categorizationModels = [
  { id: "gpt-5-mini", name: "GPT-5 mini" },
  { id: "gpt-5-nano", name: "GPT-5 nano" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 nano" },
  { id: "gpt-4.1", name: "GPT-4.1" },
  { id: "gpt-4o-mini", name: "GPT-4o mini" },
];
export function compatibleModels(ids) {
  const available = new Set(ids);
  return categorizationModels.filter((m) => available.has(m.id));
}
