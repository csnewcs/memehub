import { useEffect, useState, type ReactNode } from 'react';
import { metadata, siteTitle } from '../model/metadata';
import type { Meme } from '../model/types';
import { useMemeMedia } from '../api/queries';
import { Dialog, DialogTitle, DialogTrigger } from '../../../shared/ui/dialog';
import {
  DialogPanel,
  DialogBody,
  DialogPanelHeader,
  DialogPanelFooter,
} from '../../../shared/ui/dialog-layout';
import { Button } from '../../../shared/ui/button';
import {
  CopyIcon,
  DetailsIcon,
  CheckIcon,
  LoadingIcon,
  BookmarkIcon,
} from '../../../shared/ui/icons';
import { copyImage } from '../../../shared/lib/copy-image';
import { MemeShare } from './MemeShare';
import { Skeleton } from '../../../shared/ui/skeleton';

function ImagePreview({ meme, full = false }: { meme: Meme; full?: boolean }) {
  const media = useMemeMedia(meme.id);
  const [failedSrc, setFailedSrc] = useState<string>();
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const src = full ? media.data?.original.url : media.data?.thumbnail.url;
  const failed = (!src && media.isError) || (!!src && failedSrc === src);
  const loaded = !!src && loadedSrc === src;
  const ratio = meme.width && meme.height ? meme.width / meme.height : undefined;
  return (
    <div
      className={
        full
          ? 'relative flex h-full w-full min-h-0 items-center justify-center'
          : 'relative overflow-hidden'
      }
      style={
        !full ? { aspectRatio: ratio ?? (!loaded ? 1 : undefined), maxHeight: '70dvh' } : undefined
      }
      aria-busy={!loaded && !failed}
    >
      {!loaded && !failed && (
        <Skeleton
          className="absolute inset-0 rounded-none motion-reduce:animate-none"
          role="status"
        >
          <span className="sr-only">Loading image…</span>
        </Skeleton>
      )}
      {src && !failed ? (
        <img
          src={src}
          alt={meme.title || meme.description || 'Saved meme'}
          loading={full ? 'eager' : 'lazy'}
          decoding="async"
          width={meme.width ?? undefined}
          height={meme.height ?? undefined}
          onLoad={() => setLoadedSrc(src)}
          className={`${full ? 'mx-auto max-h-full max-w-full object-contain' : 'h-auto max-h-[70dvh] w-full object-contain'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onError={() => setFailedSrc(src)}
        />
      ) : failed ? (
        <div
          role="status"
          className="flex min-h-24 items-center justify-center text-center text-xs text-muted-foreground"
        >
          Image preview unavailable
        </div>
      ) : null}
    </div>
  );
}

export function MemeCard({
  meme,
  index,
  onTagSearch,
  onUserSearch,
  onSave,
  manage,
  analysis,
  detailOnly = false,
  onClose,
}: {
  meme: Meme;
  index: number;
  onTagSearch: (tag: string) => void;
  onUserSearch: (username: string) => void;
  onSave: () => void;
  manage?: (props: {
    content: ReactNode;
    actions: ReactNode;
    onDeleted: () => void;
    onPendingChange: (pending: boolean) => void;
  }) => ReactNode;
  analysis?: ReactNode;
  detailOnly?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(detailOnly);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.title;
    document.title = metadata(window.location.origin, '/api', meme).title;
    return () => {
      document.title = detailOnly ? siteTitle : previous;
    };
  }, [open, meme, detailOnly]);
  function changeOpen(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) onClose?.();
  }
  const content = (
    <>
      <DialogPanelHeader>
        <DialogTitle>
          {meme.title || (meme.content_type === 'image' ? 'Image details' : 'Text details')}
        </DialogTitle>
      </DialogPanelHeader>
      <DialogBody className="space-y-5 break-words">
        {analysis}
        <p className="text-xs text-muted-foreground">
          {meme.created_by_name || 'Unknown uploader'}
          {meme.created_by_username && (
            <button
              type="button"
              className="ml-1 hover:underline"
              onClick={() => {
                changeOpen(false);
                onUserSearch(meme.created_by_username!);
              }}
            >
              @{meme.created_by_username}
            </button>
          )}
          {' · '}
          <time dateTime={meme.created_at}>
            {new Date(meme.created_at).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </time>
        </p>
        {meme.description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meme.description}</p>
        )}
        {meme.content_type === 'text' && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{meme.body_text}</p>
        )}
        <section aria-label="Tags" className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Tags</h3>
          {meme.tags.length ? (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {meme.tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="cursor-pointer hover:underline focus-visible:underline"
                    onClick={() => {
                      changeOpen(false);
                      onTagSearch(tag);
                    }}
                  >
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No tags yet.</p>
          )}
        </section>
        {meme.extracted_text && (
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Extracted text</h3>
            <p className="whitespace-pre-wrap text-sm">{meme.extracted_text}</p>
          </section>
        )}
        {(meme.source_name || meme.source_author || meme.source_url) && (
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Source</h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              {meme.source_name && <p>{meme.source_name}</p>}
              {meme.source_author && <p>{meme.source_author}</p>}
              {meme.source_url && (
                <a
                  href={meme.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  View source
                </a>
              )}
            </div>
          </section>
        )}
      </DialogBody>
    </>
  );
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {!detailOnly && (
        <article
          className="meme-card min-w-0 overflow-hidden"
          style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
        >
          {meme.content_type === 'image' ? (
            <div className="group relative">
              <ImagePreview meme={meme} />
              <ImageActions meme={meme} onSave={onSave} />
            </div>
          ) : (
            <DialogTrigger asChild>
              <button
                type="button"
                className="block w-full cursor-pointer text-left outline-none"
                aria-label={`View details: ${meme.title || 'Text'}`}
              >
                <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm leading-snug">
                  {meme.body_text}
                </p>
              </button>
            </DialogTrigger>
          )}
        </article>
      )}
      <DialogPanel
        size={meme.content_type === 'image' ? 'wide' : 'default'}
        aria-describedby={undefined}
      >
        <div
          className={
            meme.content_type === 'image'
              ? 'grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:grid-rows-1'
              : 'flex min-h-0 flex-1 flex-col'
          }
        >
          {meme.content_type === 'image' && (
            <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6">
              <ImagePreview meme={meme} full />
            </div>
          )}
          {manage ? (
            manage({
              content,
              actions: (
                <>
                  <MemeShare meme={meme} />
                  <SaveButton onSave={onSave} />
                </>
              ),
              onDeleted: () => changeOpen(false),
              onPendingChange: setBusy,
            })
          ) : (
            <div className="flex min-h-0 min-w-0 flex-col">
              {content}
              <DialogPanelFooter>
                <MemeShare meme={meme} />
                <SaveButton onSave={onSave} />
              </DialogPanelFooter>
            </div>
          )}
        </div>
      </DialogPanel>
    </Dialog>
  );
}

function SaveButton({ onSave }: { onSave: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      aria-label="Add to collection"
      title="Add to collection"
      onClick={onSave}
    >
      <BookmarkIcon aria-hidden="true" />
    </Button>
  );
}

function ImageActions({ meme, onSave }: { meme: Meme; onSave: () => void }) {
  const media = useMemeMedia(meme.id);
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state !== 'copied' && state !== 'failed') return;
    const timer = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  async function copy() {
    setState('copying');
    try {
      await copyImage(async () => {
        const data = media.data ?? (await media.refetch()).data;
        if (!data) throw new Error('Image unavailable');
        return data.original.url;
      });
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  return (
    <div
      className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6 transition-opacity [&>button]:size-6 group-hover:opacity-100 group-focus-within:opacity-100 group-has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100 ${state === 'idle' ? 'opacity-0' : 'opacity-100'}`}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={state === 'copied' ? 'Image copied' : 'Copy image'}
        title="Copy image (animated images copy as still images)"
        disabled={state === 'copying'}
        onClick={() => void copy()}
      >
        {state === 'copying' ? (
          <LoadingIcon className="animate-spin" aria-hidden="true" />
        ) : state === 'copied' ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
      </Button>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label={`View details: ${meme.title || 'Image'}`}
          title="View details"
        >
          <DetailsIcon aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <MemeShare meme={meme} />
      <SaveButton onSave={onSave} />
      {state === 'failed' && (
        <span role="alert" className="w-full text-right text-xs text-white">
          Could not copy. Try again.
        </span>
      )}
    </div>
  );
}
