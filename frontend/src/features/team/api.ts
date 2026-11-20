import { apiClient } from "@/api/client";
import type { PaginatedResponse, Role } from "@/types";

export interface TeamMember {
  public_id: string;
  email: string;
  full_name: string;
  role: Role;
  job_title: string;
  is_active_member: boolean;
  date_joined: string;
}

export interface CreateTeamMemberPayload {
  email: string;
  first_name: string;
  last_name?: string;
  role: Role;
  job_title?: string;
  password: string;
}

export async function fetchTeamMembers(params: {
  page?: number;
  search?: string;
  role?: string;
  is_active_member?: string;
}) {
  const { data } = await apiClient.get<PaginatedResponse<TeamMember>>("/team/", { params });
  return data;
}

export async function createTeamMember(payload: CreateTeamMemberPayload) {
  const { data } = await apiClient.post<TeamMember>("/team/", payload);
  return data;
}

export async function updateTeamMember(
  publicId: string,
  payload: Partial<Pick<TeamMember, "role" | "job_title" | "is_active_member">>
) {
  const { data } = await apiClient.patch<TeamMember>(`/team/${publicId}/`, payload);
  return data;
}

export async function deleteTeamMember(publicId: string) {
  await apiClient.delete(`/team/${publicId}/`);
}
