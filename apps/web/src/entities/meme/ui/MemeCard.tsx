import { useState, type ReactNode } from 'react';
import type { Meme } from '../model/types';
import { useMemeMedia } from '../api/queries';
import { Dialog, DialogTitle, DialogTrigger } from '../../../shared/ui/dialog';
import { DialogPanel, DialogBody, DialogPanelHeader } from '../../../shared/ui/dialog-layout';

function ImagePreview({ meme, full = false }: { meme: Meme; full?: boolean }) {
  const media = useMemeMedia(meme.id);
  const [failedSrc, setFailedSrc] = useState<string>();
  const src = full ? media.data?.original.url : media.data?.thumbnail.url;
  const failed = !!src && failedSrc === src;
  return (
    <div className={full ? 'flex h-full min-h-0 items-center justify-center' : 'overflow-hidden'}>
      {src && !failed ? (
        <img
          src={src}
          alt={meme.title || meme.description || 'Saved meme'}
          loading={full ? 'eager' : 'lazy'}
          className={
            full
              ? 'mx-auto max-h-full max-w-full object-contain'
              : 'h-auto max-h-[70dvh] w-full object-contain'
          }
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div
          role="status"
          className="flex min-h-24 items-center justify-center text-center text-xs text-muted-foreground"
        >
          {failed || media.isError ? 'Image preview unavailable' : 'Loading image…'}
        </div>
      )}
    </div>
  );
}

export function MemeCard({
  meme,
  index,
  onTagSearch,
  onUserSearch,
  manage,
}: {
  meme: Meme;
  index: number;
  onTagSearch: (tag: string) => void;
  onUserSearch: (username: string) => void;
  manage?: (props: {
    content: ReactNode;
    onDeleted: () => void;
    onPendingChange: (pending: boolean) => void;
  }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const content = (
    <>
      <DialogPanelHeader>
        <DialogTitle>
          {meme.title || (meme.content_type === 'image' ? 'Image details' : 'Text details')}
        </DialogTitle>
      </DialogPanelHeader>
      <DialogBody className="space-y-5 break-words">
        <p className="text-xs text-muted-foreground">
          {meme.created_by_name || 'Unknown uploader'}
          {meme.created_by_username && (
            <button
              type="button"
              className="ml-1 hover:underline"
              onClick={() => {
                setOpen(false);
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
                      setOpen(false);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <article
        className="meme-card min-w-0 overflow-hidden"
        style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label={`View details: ${meme.title || (meme.content_type === 'image' ? 'Image' : 'Text')}`}
          >
            {meme.content_type === 'image' ? (
              <ImagePreview meme={meme} />
            ) : (
              <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm leading-snug">
                {meme.body_text}
              </p>
            )}
          </button>
        </DialogTrigger>
      </article>
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
            manage({ content, onDeleted: () => setOpen(false), onPendingChange: setBusy })
          ) : (
            <div className="flex min-h-0 min-w-0 flex-col pb-6">{content}</div>
          )}
        </div>
      </DialogPanel>
    </Dialog>
  );
}
