import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../entities/session';
import { setCollectionMeme, useCollections, type Collection } from '../../../entities/collection';
import { apiError, endpoint, useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import { CheckIcon, CollectionIcon, LoadingIcon, PlusIcon } from '../../../shared/ui/icons';
import { Dialog, DialogDescription, DialogTitle } from '../../../shared/ui/dialog';
import { DialogBody, DialogPanel, DialogPanelHeader } from '../../../shared/ui/dialog-layout';
import { CollectionForm } from './CollectionForm';

export function SaveToCollection({ memeId, onClose }: { memeId: string; onClose: () => void }) {
  const api = useApi();
  const cache = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: () => getSession(api) });
  const userId = session.data?.id || '';
  const collections = useCollections(userId, true, memeId);
  const [message, setMessage] = useState('');
  const change = useMutation({
    mutationFn: (collection: Collection) =>
      setCollectionMeme(api, collection.id, memeId, !collection.contains_meme),
    onMutate: () => setMessage(''),
    onSuccess: async (_, collection) => {
      setMessage(
        collection.contains_meme
          ? `Removed from “${collection.name}”.`
          : `Saved to “${collection.name}”.`,
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['collections', userId] }),
        cache.invalidateQueries({ queryKey: ['memes'] }),
      ]);
    },
  });
  const items = collections.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPanel className="sm:max-w-sm">
        <DialogPanelHeader>
          <DialogTitle>Save to collection</DialogTitle>
          <DialogDescription>
            Choose collections for this meme, or create a new one.
          </DialogDescription>
        </DialogPanelHeader>
        <DialogBody className="space-y-5 pb-6">
          {session.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading account…
            </p>
          )}
          {session.isError && (
            <div role="alert" className="space-y-2 text-sm">
              <p>{apiError(session.error)}</p>
              <Button variant="secondary" onClick={() => void session.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {session.isSuccess && !session.data && (
            <div className="space-y-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Sign in to save memes to your collections.
              </p>
              <Button asChild className="w-full">
                <a
                  onClick={() => sessionStorage.setItem('memehub.pendingCollectionMeme', memeId)}
                  href={
                    new URL(
                      endpoint(api.defaults.baseURL || '/api', 'auth/login'),
                      import.meta.env.PUBLIC_APP_BASE_URL || window.location.origin,
                    ).href
                  }
                >
                  Sign in
                </a>
              </Button>
            </div>
          )}
          {!!userId && (
            <>
              <div>
                {collections.isPending && (
                  <p role="status" className="py-4 text-sm text-muted-foreground">
                    Loading collections…
                  </p>
                )}
                {collections.isSuccess && !items.length && (
                  <div className="space-y-2 py-4 text-center text-muted-foreground">
                    <CollectionIcon className="mx-auto size-7" aria-hidden="true" />
                    <p className="text-sm">Your first collection starts here.</p>
                  </div>
                )}
                <ul className="space-y-1">
                  {items.map((collection) => (
                    <li key={collection.id}>
                      <Button
                        variant="ghost"
                        className="h-auto min-h-12 w-full justify-start whitespace-normal px-2 py-3 text-left"
                        aria-pressed={collection.contains_meme}
                        aria-label={`${collection.contains_meme ? 'Remove from' : 'Add to'} ${collection.name}`}
                        disabled={change.isPending}
                        onClick={() => change.mutate(collection)}
                      >
                        <CollectionIcon className="text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 break-words">{collection.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {collection.meme_count}
                        </span>
                        {change.isPending && change.variables.id === collection.id ? (
                          <LoadingIcon className="animate-spin" aria-hidden="true" />
                        ) : collection.contains_meme ? (
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <PlusIcon className="text-muted-foreground" aria-hidden="true" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
                {collections.hasNextPage && (
                  <Button
                    variant="ghost"
                    className="mt-2 w-full"
                    disabled={collections.isFetchingNextPage}
                    onClick={() => void collections.fetchNextPage()}
                  >
                    {collections.isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </Button>
                )}
                {collections.isError && (
                  <div role="alert" className="space-y-2 py-3 text-sm">
                    <p>{apiError(collections.error)}</p>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void (collections.isFetchNextPageError
                          ? collections.fetchNextPage()
                          : collections.refetch())
                      }
                    >
                      Try again
                    </Button>
                  </div>
                )}
                {change.isError && (
                  <p role="alert" className="pt-2 text-xs text-destructive">
                    {apiError(change.error)}
                  </p>
                )}
              </div>
              <div className="border-t pt-5">
                <CollectionForm
                  userId={userId}
                  memeId={memeId}
                  disabled={change.isPending}
                  onCreated={(collection) => setMessage(`Saved to “${collection.name}”.`)}
                />
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {message}
              </p>
            </>
          )}
        </DialogBody>
      </DialogPanel>
    </Dialog>
  );
}
