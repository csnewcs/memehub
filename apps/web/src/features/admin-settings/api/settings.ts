import type { AxiosInstance } from 'axios';
export type Settings = {
  openai_model: string;
  deleted_image_retention_days: number;
  incomplete_upload_retention_hours: number;
  revision: number;
};
export async function getSettings(api: AxiosInstance, signal?: AbortSignal) {
  return (await api.get<Settings>('admin/settings', { signal })).data;
}
export async function saveSettings(api: AxiosInstance, value: Settings) {
  return (await api.put<Settings>('admin/settings', value)).data;
}
