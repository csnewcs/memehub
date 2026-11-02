import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiError, useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { TagIcon } from '../../../shared/ui/icons';
import { Dialog, DialogTrigger, DialogTitle, DialogDescription } from '../../../shared/ui/dialog';
import { DialogPanel, DialogPanelHeader, DialogBody } from '../../../shared/ui/dialog-layout';
import { listTags } from '../api/tags';

export function BrowseTags({ onSelect }: { onSelect: (tag: string) => void }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (composing) return;
    const timer = window.setTimeout(() => setSearch(draft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [draft, composing]);
  const query = useInfiniteQuery({
    queryKey: ['tags', search],
    staleTime: 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listTags(api, search, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: open && !composing,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-[46px] shrink-0 rounded-full bg-muted/95 backdrop-blur-xl dark:bg-muted/95"
          aria-label="Browse tags"
          title="Browse tags"
        >
          <TagIcon aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogPanel>
        <DialogPanelHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>Browse by popularity or find a tag.</DialogDescription>
        </DialogPanelHeader>
        <div className="shrink-0 px-6 pb-3">
          <Input
            aria-label="Search tags"
            placeholder="Search tags"
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setDraft(e.currentTarget.value);
              setComposing(false);
            }}
          />
        </div>
        <DialogBody
          className="min-h-40 pb-6"
          onScroll={(event) => {
            const element = event.currentTarget;
            if (
              open &&
              !composing &&
              draft.trim() === search &&
              query.hasNextPage &&
              !query.isFetching &&
              !query.isError &&
              element.scrollHeight - element.scrollTop - element.clientHeight <= 160
            )
              void query.fetchNextPage({ cancelRefetch: false });
          }}
        >
          {query.isPending && (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">
              Loading tags…
            </p>
          )}
          {query.isSuccess && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No tags found.</p>
          )}
          <ul className="space-y-1">
            {items.map((tag) => (
              <li key={tag.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-10 w-full justify-between gap-4 whitespace-normal py-2 text-left"
                  onClick={() => {
                    onSelect(tag.name);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 break-words">{tag.name}</span>
                  <span
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    aria-label={`${tag.meme_count} memes`}
                  >
                    {tag.meme_count}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {query.isFetchingNextPage && (
            <p role="status" className="py-3 text-center text-xs text-muted-foreground">
              Loading more tags…
            </p>
          )}
          {query.isError && (
            <div role="alert" className="space-y-2 py-4 text-sm">
              <p>{apiError(query.error)}</p>
              <Button
                variant="secondary"
                onClick={() =>
                  void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                }
              >
                Try again
              </Button>
            </div>
          )}
        </DialogBody>
      </DialogPanel>
    </Dialog>
  );
}
