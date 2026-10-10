export type TemplateSetupRequirement = "body_parameters" | "header_parameters" | "media_header" | "dynamic_button" | "carousel" | "invalid_definition";

export type TemplateSetupPolicy = {
  sendableWithoutSetup: boolean;
  requirements: TemplateSetupRequirement[];
};

const placeholder = /\{\{[^}]+\}\}/;

export function templateSetupPolicy(value: unknown): TemplateSetupPolicy {
  if (!Array.isArray(value)) return { sendableWithoutSetup: false, requirements: ["invalid_definition"] };

  const requirements = new Set<TemplateSetupRequirement>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      requirements.add("invalid_definition");
      continue;
    }

    const component = entry as { type?: unknown; format?: unknown; text?: unknown; buttons?: unknown; cards?: unknown };
    const type = typeof component.type === "string" ? component.type.toUpperCase() : "";
    const format = typeof component.format === "string" ? component.format.toUpperCase() : "";
    const text = typeof component.text === "string" ? component.text : "";

    if (type === "BODY" && placeholder.test(text)) requirements.add("body_parameters");
    if (type === "HEADER" && placeholder.test(text)) requirements.add("header_parameters");
    if (type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(format)) requirements.add("media_header");
    if (type === "CAROUSEL" || Array.isArray(component.cards)) requirements.add("carousel");

    if (type === "BUTTONS" && Array.isArray(component.buttons)) {
      for (const button of component.buttons) {
        if (!button || typeof button !== "object") continue;
        const url = (button as { url?: unknown }).url;
        if (typeof url === "string" && placeholder.test(url)) requirements.add("dynamic_button");
      }
    }
  }

  return { sendableWithoutSetup: requirements.size === 0, requirements: [...requirements] };
}
