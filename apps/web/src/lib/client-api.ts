export type WorkspaceData = {
  workspace: { id: string; name: string; slug: string; role: string } | null;
  features: Array<{ key: string; limits?: Record<string, unknown> }>;
  channels: Array<{ id: string; display_name: string; status: string }>;
  platformAdmin: boolean;
};

type Success<T> = { data: T };
type Failure = { error?: { message?: string } };

export async function apiData<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload = await response.json() as Success<T> & Failure;
  if (!response.ok || !("data" in payload)) throw new Error(payload.error?.message ?? "The request could not be completed");
  return payload.data;
}

export function loadWorkspace(signal?: AbortSignal) {
  return apiData<WorkspaceData>("/api/v1/workspace", { signal });
}
