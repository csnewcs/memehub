import { useState, type SubmitEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCollection, type Collection } from '../../../entities/collection';
import { apiError, useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { LoadingIcon, PlusIcon } from '../../../shared/ui/icons';

export function CollectionForm({
  userId,
  memeId,
  onCreated,
  disabled = false,
}: {
  userId: string;
  memeId?: string;
  onCreated: (collection: Collection) => void;
  disabled?: boolean;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => createCollection(api, name, memeId),
    onSuccess: async (collection) => {
      setName('');
      await cache.invalidateQueries({ queryKey: ['collections', userId] });
      onCreated(collection);
    },
  });
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() && !create.isPending && !disabled) create.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-2 text-xs font-medium">
        New collection
        <Input
          name="collection-name"
          placeholder="Give it a name"
          value={name}
          maxLength={100}
          required
          disabled={create.isPending || disabled}
          onChange={(event) => {
            setName(event.target.value);
            create.reset();
          }}
        />
      </label>
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        disabled={!name.trim() || create.isPending || disabled}
      >
        {create.isPending ? <LoadingIcon className="animate-spin" /> : <PlusIcon />}
        {memeId ? 'Create & save' : 'Create collection'}
      </Button>
      {create.isError && (
        <p role="alert" className="text-xs text-destructive">
          {apiError(create.error)}
        </p>
      )}
    </form>
  );
}
