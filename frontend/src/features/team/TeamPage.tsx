import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Users, Trash2, Shield } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  fetchTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  type TeamMember,
} from "./api";
import { extractErrorMessage } from "@/api/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import type { Role } from "@/types";

const memberSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "manager", "employee"]),
  job_title: z.string().optional(),
  password: z.string().min(8, "Minimum 8 characters"),
});

type MemberFormValues = z.infer<typeof memberSchema>;

export function TeamPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["team-members", { page, search: debouncedSearch, roleFilter, statusFilter }],
    queryFn: () =>
      fetchTeamMembers({
        page,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        is_active_member: statusFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { role: "employee", first_name: "", last_name: "", email: "", job_title: "", password: "" },
  });

  const createMut = useMutation({
    mutationFn: createTeamMember,
    onSuccess: () => {
      toast.success("Team member added");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-options"] });
      reset();
      setAddOpen(false);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ publicId, payload }: { publicId: string; payload: Partial<Pick<TeamMember, "role" | "is_active_member">> }) =>
      updateTeamMember(publicId, payload),
    onSuccess: () => {
      toast.success("Member updated");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-options"] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTeamMember,
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-options"] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-primary">Team Management</h1>
          <p className="text-sm text-muted">
            Manage roles, workspace access, and active members in {currentUser?.organization?.name || "your organization"}.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search name or email..."
        />
        <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="w-40">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-40">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : !data?.results.length ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add colleagues to assign tasks, manage deals, and collaborate across your workspace."
          />
        ) : (
          <>
            <div className={isFetching ? "overflow-x-auto opacity-60 transition-opacity" : "overflow-x-auto transition-opacity"}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-raised/60 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Job Title</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.results.map((m) => (
                    <tr key={m.public_id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary">{m.full_name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </td>
                      <td className="px-4 py-3 text-secondary">{m.job_title || "—"}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={m.role}
                          aria-label={`Role for ${m.full_name}`}
                          onChange={(e) =>
                            updateMut.mutate({ publicId: m.public_id, payload: { role: e.target.value as Role } })
                          }
                          className="w-32"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateMut.mutate({
                              publicId: m.public_id,
                              payload: { is_active_member: !m.is_active_member },
                            })
                          }
                          title="Click to toggle active status"
                        >
                          <Badge tone={m.is_active_member ? "success" : "warning"}>
                            {m.is_active_member ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted font-tabular">
                        {format(new Date(m.date_joined), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(m)}
                          aria-label={`Remove ${m.full_name}`}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={data.current_page}
              totalPages={data.total_pages}
              totalCount={data.count}
              pageSize={data.page_size}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Team Member">
        <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">First Name</label>
              <Input {...register("first_name")} placeholder="Jane" />
              {errors.first_name && <p className="mt-1 text-xs text-danger">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Last Name</label>
              <Input {...register("last_name")} placeholder="Doe" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Work Email</label>
            <Input type="email" {...register("email")} placeholder="jane@company.com" />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Role</label>
              <Select {...register("role")}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">Job Title</label>
              <Input {...register("job_title")} placeholder="Operations Lead" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Temporary Password</label>
            <Input type="password" {...register("password")} placeholder="Min 8 characters" />
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMut.isPending}>
              <Shield className="h-4 w-4" />
              Create Member
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Team Member" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            Remove <span className="font-medium text-primary">{confirmDelete?.full_name}</span> ({confirmDelete?.email}) from the workspace? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMut.isPending}
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.public_id)}
            >
              Remove Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
