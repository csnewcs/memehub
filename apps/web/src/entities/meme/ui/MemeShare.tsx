import { useEffect, useState } from 'react';
import type { Meme } from '../model/types';
import { memeShareURLs } from '../model/share';
import { useApi } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/button';
import { LinkIcon, CheckIcon } from '../../../shared/ui/icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../shared/ui/dropdown-menu';
export function MemeShare({ meme }: { meme: Meme }) {
  const api = useApi();
  const [copied, setCopied] = useState<'media' | 'detail' | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied && !failed) return;
    const timer = window.setTimeout(() => {
      setCopied(null);
      setFailed(false);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [copied, failed]);
  async function copy(kind: 'media' | 'detail') {
    setFailed(false);
    setCopied(null);
    try {
      const urls = memeShareURLs(
        meme.id,
        import.meta.env.PUBLIC_APP_BASE_URL || window.location.origin,
        api.defaults.baseURL || '/api',
      );
      await navigator.clipboard.writeText(urls[kind]);
      setCopied(kind);
    } catch {
      setFailed(true);
    }
  }
  const kinds: ('media' | 'detail')[] =
    meme.content_type === 'image' ? ['media', 'detail'] : ['detail'];
  const label = (kind: 'media' | 'detail') =>
    kind === 'media' ? 'Copy media URL' : 'Copy detail URL';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="Copy share URL"
          title="Copy share URL"
        >
          {copied ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        {kinds.map((kind) => (
          <DropdownMenuItem
            key={kind}
            onSelect={(e) => {
              e.preventDefault();
              void copy(kind);
            }}
          >
            {copied === kind ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
            {label(kind)}
          </DropdownMenuItem>
        ))}
        {failed && (
          <p role="alert" className="px-2 py-1 text-xs text-destructive">
            Could not copy URL. Try again.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
