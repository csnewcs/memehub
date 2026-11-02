import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiError, useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import type { Meme } from '../../../entities/meme';

type Analysis = {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
};
export function ManageAnalysis({
  meme,
  hideCompleted = false,
}: {
  meme: Meme;
  hideCompleted?: boolean;
}) {
  const api = useApi();
  const cache = useQueryClient();
  const key = ['admin-analyses', meme.id];
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await api.get<{ analysis_status: string; items: Analysis[] }>(
          `admin/memes/${meme.id}/analyses`,
        )
      ).data,
    refetchInterval: (query) =>
      ['queued', 'processing'].includes(query.state.data?.analysis_status ?? '') ? 3_000 : false,
  });
  const retry = useMutation({
    mutationFn: () =>
      api.post(`admin/memes/${meme.id}/analyses`, { content_revision: meme.content_revision }),
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: key });
      void cache.invalidateQueries({ queryKey: ['memes'] });
      void cache.invalidateQueries({ queryKey: ['admin-memes'] });
    },
  });
  if (hideCompleted && (query.data?.analysis_status ?? meme.analysis_status) === 'completed')
    return null;
  const latest = query.data?.items[0];
  return (
    <section aria-label="AI analysis" className="space-y-2 text-xs">
      <h3 className="font-medium text-muted-foreground">AI analysis</h3>
      <p role="status">
        {query.isPending ? 'Loading…' : query.data?.analysis_status.replaceAll('_', ' ')}
      </p>
      {latest && (
        <p className="text-muted-foreground">
          Attempts: {latest.attempts}/{latest.max_attempts}
        </p>
      )}
      {latest?.error_code && (
        <p className="text-muted-foreground">{latest.error_code.replaceAll('_', ' ')}</p>
      )}
      {latest?.status === 'failed' && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={retry.isPending}
          onClick={() => retry.mutate()}
        >
          {retry.isPending ? 'Queuing…' : 'Retry analysis'}
        </Button>
      )}
      {(query.error || retry.error) && (
        <p role="alert" className="text-destructive">
          {apiError(query.error || retry.error)}
        </p>
      )}
    </section>
  );
}
