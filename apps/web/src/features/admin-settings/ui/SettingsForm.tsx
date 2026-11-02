import { useState, type SubmitEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiError, useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { getSettings, saveSettings, type Settings } from '../api/settings';

export function SettingsForm() {
  const api = useApi();
  const query = useQuery({
    queryKey: ['admin-settings'],
    queryFn: ({ signal }) => getSettings(api, signal),
  });
  if (query.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading settings…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>{apiError(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  return <SettingsEditor initial={query.data} />;
}
function SettingsEditor({ initial }: { initial: Settings }) {
  const api = useApi();
  const cache = useQueryClient();
  const [value, setValue] = useState(initial);
  const mutation = useMutation({
    mutationFn: () => saveSettings(api, value),
    onSuccess: (saved) => {
      setValue(saved);
      cache.setQueryData(['admin-settings'], saved);
    },
  });
  const reload = useMutation({
    mutationFn: () => getSettings(api),
    onSuccess: (saved) => {
      setValue(saved);
      cache.setQueryData(['admin-settings'], saved);
      mutation.reset();
    },
  });
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage AI analysis and file retention.</p>
      </div>
      <fieldset disabled={mutation.isPending || reload.isPending} className="space-y-6">
        <label className="block space-y-2 text-sm">
          <span className="font-medium">OpenAI model</span>
          <Input
            required
            maxLength={200}
            pattern="[a-zA-Z0-9][a-zA-Z0-9._:/\-]{0,199}"
            value={value.openai_model}
            onChange={(e) => {
              setValue({ ...value, openai_model: e.target.value });
              mutation.reset();
            }}
          />
          <span className="block text-xs text-muted-foreground">
            Applies to new uploads and manual retries. Use a model that supports image input.
          </span>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Deleted image retention (days)</span>
          <Input
            required
            type="number"
            min={1}
            max={365}
            step={1}
            value={
              Number.isNaN(value.deleted_image_retention_days)
                ? ''
                : value.deleted_image_retention_days
            }
            onChange={(e) => {
              setValue({ ...value, deleted_image_retention_days: e.target.valueAsNumber });
              mutation.reset();
            }}
          />
          <span className="block text-xs text-muted-foreground">
            1–365 days. Original images and previews are permanently removed after this period.
          </span>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Incomplete upload retention (hours)</span>
          <Input
            required
            type="number"
            min={2}
            max={168}
            step={1}
            value={
              Number.isNaN(value.incomplete_upload_retention_hours)
                ? ''
                : value.incomplete_upload_retention_hours
            }
            onChange={(e) => {
              setValue({ ...value, incomplete_upload_retention_hours: e.target.valueAsNumber });
              mutation.reset();
            }}
          />
          <span className="block text-xs text-muted-foreground">
            2–168 hours since the last upload update.
          </span>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Retention changes apply to existing files on the next cleanup pass. Deleted files cannot be
        recovered.
      </p>
      {mutation.isError && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{apiError(mutation.error)}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reload.mutate();
            }}
          >
            Reload settings
          </Button>
        </div>
      )}
      {reload.isError && (
        <p role="alert" className="text-sm text-destructive">
          {apiError(reload.error)}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending || reload.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {mutation.isSuccess && (
          <p role="status" className="text-xs text-muted-foreground">
            Saved
          </p>
        )}
      </div>
    </form>
  );
}
