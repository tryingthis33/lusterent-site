import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, buildUrl, type AdminUser } from "@shared/routes";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function UsersAdmin() {
  const { toast } = useToast();
  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: [api.admin.listUsers.path],
  });
  const { user: authUser } = useAuth();

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "member" }) => {
      const url = buildUrl(api.admin.updateUserRole.path, { id });
      const res = await apiRequest("PATCH", url, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listUsers.path] });
      toast({ title: "Role updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-[#666] text-sm">Loading users…</div>;

  return (
    <div data-testid="table-admin-users">
      <p className="text-[#666] text-xs mb-4 tracking-wide">
        Grant or revoke portal admin access. Admins can triage applications, manage accounts, and manage other admins.
      </p>
      <Table>
        <TableHeader>
          <TableRow className="border-[#D4AF37]/10">
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">User</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Email</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Joined</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Role</TableHead>
            <TableHead className="text-[#D4AF37]/60 text-[10px] uppercase tracking-widest">Admin Access</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((u) => {
            const isSelf = authUser?.id === u.id;
            const isAdmin = u.role === "admin";
            const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
            return (
              <TableRow key={u.id} className="border-[#D4AF37]/10" data-testid={`row-user-${u.id}`}>
                <TableCell className="text-white text-sm">
                  {name}
                  {isSelf && <span className="text-[#D4AF37]/60 text-[10px] ml-2 uppercase tracking-widest">(you)</span>}
                </TableCell>
                <TableCell className="text-[#999] text-sm">{u.email ?? "—"}</TableCell>
                <TableCell className="text-[#666] text-xs">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${isAdmin ? "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"} text-[9px] tracking-widest uppercase`}
                    data-testid={`badge-role-${u.id}`}
                  >
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={isAdmin}
                    disabled={isSelf || roleMutation.isPending}
                    onCheckedChange={(checked) =>
                      roleMutation.mutate({ id: u.id, role: checked ? "admin" : "member" })
                    }
                    data-testid={`switch-admin-${u.id}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {users?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-[#666] text-sm text-center py-8">
                No users yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
