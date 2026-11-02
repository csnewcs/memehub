import type { AxiosInstance } from 'axios';
export type AdminUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
};
export type UserPage = { items: AdminUser[]; next_cursor: string | null };
export async function listUsers(
  api: AxiosInstance,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<UserPage> {
  return (
    await api.get<UserPage>('admin/users', {
      signal,
      params: { limit: 50, cursor: cursor || undefined },
    })
  ).data;
}
