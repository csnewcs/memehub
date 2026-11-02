import { isAxiosError, type AxiosInstance } from 'axios';

type Session = {
  id: string;
  display_name: string | null;
  username: string | null;
  is_admin: boolean;
};
export async function getSession(api: AxiosInstance): Promise<Session | null> {
  try {
    const { data } = await api.get<Session>('auth/me');
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
}

export async function logoutSession(api: AxiosInstance): Promise<void> {
  try {
    await api.post('auth/logout');
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 401) throw error;
  }
}
