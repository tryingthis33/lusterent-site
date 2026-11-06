import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type WebsiteInput } from "@shared/routes";

// GET /api/websites
export function useWebsites() {
  return useQuery({
    queryKey: [api.websites.list.path],
    queryFn: async () => {
      const res = await fetch(api.websites.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch websites");
      return api.websites.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/websites/:id
export function useWebsite(id: number) {
  return useQuery({
    queryKey: [api.websites.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      const url = buildUrl(api.websites.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch website details");
      return api.websites.get.responses[200].parse(await res.json());
    },
  });
}

// POST /api/websites
export function useCreateWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WebsiteInput) => {
      const res = await fetch(api.websites.create.path, {
        method: api.websites.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.websites.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create website");
      }
      return api.websites.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.websites.list.path] });
    },
  });
}

// PUT /api/websites/:id
export function useUpdateWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<WebsiteInput>) => {
      const url = buildUrl(api.websites.update.path, { id });
      const res = await fetch(url, {
        method: api.websites.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.websites.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to update website");
      }
      return api.websites.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.websites.list.path] });
    },
  });
}

// DELETE /api/websites/:id
export function useDeleteWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.websites.delete.path, { id });
      const res = await fetch(url, {
        method: api.websites.delete.method,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to delete website");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.websites.list.path] });
    },
  });
}
