import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { UserList } from '../../../features/admin-users';
import { SettingsForm } from '../../../features/admin-settings';
import { ManageAnalysis } from '../../../features/manage-analysis';
import type { MemePage } from '../../../entities/meme';
import { Dialog, DialogTitle, DialogDescription } from '../../../shared/ui/dialog';
import { DialogPanel, DialogBody } from '../../../shared/ui/dialog-layout';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../../shared/ui/select';
import { Button } from '../../../shared/ui/button';
import { SettingsIcon, LoadingIcon, UserIcon } from '../../../shared/ui/icons';
import { apiError, useApi } from '../../../shared/api/client';

export function AdminSettings({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<'general' | 'analysis' | 'users'>('general');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPanel size="wide">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Workspace administration</DialogDescription>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label="Settings sections"
            className="flex shrink-0 gap-1 overflow-x-auto bg-muted/30 p-3 pr-12 sm:w-48 sm:flex-col sm:pr-3"
          >
            <p className="hidden px-3 py-2 text-xs text-muted-foreground sm:block">Workspace</p>
            <Button
              variant={section === 'general' ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => setSection('general')}
              aria-current={section === 'general' ? 'page' : undefined}
            >
              <SettingsIcon aria-hidden="true" /> General
            </Button>
            <Button
              variant={section === 'analysis' ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => setSection('analysis')}
              aria-current={section === 'analysis' ? 'page' : undefined}
            >
              <LoadingIcon aria-hidden="true" /> AI analysis
            </Button>
            <Button
              variant={section === 'users' ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => setSection('users')}
              aria-current={section === 'users' ? 'page' : undefined}
            >
              <UserIcon aria-hidden="true" /> Users
            </Button>
          </nav>
          <DialogBody className="py-6 sm:pr-12">
            {section === 'general' ? (
              <SettingsForm />
            ) : section === 'users' ? (
              <UserList />
            ) : (
              <AnalysisList />
            )}
          </DialogBody>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
function AnalysisList() {
  const api = useApi();
  const [status, setStatus] = useState('failed');
  const [selected, setSelected] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['admin-memes', status],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<MemePage>('admin/memes', {
          signal,
          params: {
            limit: 20,
            analysis_status: status || undefined,
            cursor: pageParam || undefined,
          },
        })
      ).data,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    refetchInterval: status === 'queued' || status === 'processing' ? 5000 : false,
  });
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">AI analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect analysis attempts and retry failed jobs.
        </p>
      </div>
      <label className="block space-y-2 text-sm">
        <span>Status</span>
        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : value);
            setSelected(null);
          }}
        >
          <SelectTrigger aria-label="Analysis status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['failed', 'queued', 'processing', 'completed', 'all'].map((value) => (
              <SelectItem key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading analyses…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-2 text-sm">
          <p>{apiError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {query.data && (
        <ul className="space-y-3">
          {query.data.pages
            .flatMap((page) => page.items)
            .map((meme) => (
              <li key={meme.id} className="rounded-lg bg-muted/30 p-3">
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between gap-3 whitespace-normal text-left"
                  aria-expanded={selected === meme.id}
                  onClick={() => setSelected(selected === meme.id ? null : meme.id)}
                >
                  <span className="min-w-0 truncate">
                    {meme.title || meme.body_text?.slice(0, 60) || 'Untitled image'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {meme.analysis_status}
                  </span>
                </Button>
                {selected === meme.id && (
                  <div className="px-3 pb-1 pt-3">
                    <ManageAnalysis meme={meme} />
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
      {query.data?.pages[0].items.length === 0 && (
        <p className="text-sm text-muted-foreground">No analyses found.</p>
      )}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  );
}
