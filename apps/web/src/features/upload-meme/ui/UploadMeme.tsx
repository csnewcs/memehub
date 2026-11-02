import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { getSession } from '../../../entities/session';
import { ArrowUpIcon, ImageIcon, LoadingIcon, PlusIcon } from '../../../shared/ui/icons';
import { Dialog, DialogTitle, DialogDescription } from '../../../shared/ui/dialog';
import {
  DialogPanel,
  DialogPanelHeader,
  DialogPanelFooter,
  DialogBody,
} from '../../../shared/ui/dialog-layout';
import { Input } from '../../../shared/ui/input';
import { Textarea } from '../../../shared/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../../../shared/ui/toggle-group';
import { Progress } from '../../../shared/ui/progress';
import { Button } from '../../../shared/ui/button';
import { apiError, endpoint, useApi } from '../../../shared/api/client';
import {
  uploadImage,
  createTextMeme,
  validateImageFile,
  type ImageInput,
  type TextInput,
} from '../api/upload';

const resumeUploadKey = 'memehub:resume-upload';

export function UploadMeme() {
  const api = useApi();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [contentType, setContentType] = useState<'image' | 'text'>('image');
  const [bodyText, setBodyText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [progress, setProgress] = useState(0);
  function beginLogin() {
    const appBase = import.meta.env.PUBLIC_APP_BASE_URL;
    if (appBase && new URL(appBase).origin !== window.location.origin) {
      // OIDC flow and session cookies must use the configured callback origin.
      const target = new URL(window.location.pathname + window.location.search, appBase);
      target.searchParams.set('upload', '1');
      window.location.assign(target.href);
      return;
    }
    sessionStorage.setItem(resumeUploadKey, '1');
    window.location.assign(endpoint(api.defaults.baseURL || '/api', 'auth/login'));
  }
  const gate = useMutation({
    mutationFn: (_resume: boolean) => getSession(api),
    onSuccess: (session, resume) => {
      if (!session) {
        if (!resume) beginLogin();
        return;
      }
      mutation.reset();
      setFileError('');
      setDragging(false);
      setOpen(true);
    },
  });
  const checkSession = gate.mutate;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('upload') === '1') {
      url.searchParams.delete('upload');
      window.history.replaceState(null, '', url);
      checkSession(false);
      return;
    }
    if (sessionStorage.getItem(resumeUploadKey) !== '1') return;
    sessionStorage.removeItem(resumeUploadKey);
    checkSession(true);
  }, [checkSession]);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mutation = useMutation({
    mutationFn: (input: ImageInput | TextInput) =>
      'file' in input ? uploadImage(api, input, setProgress) : createTextMeme(api, input),
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        setOpen(false);
        beginLogin();
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['memes'] });
      form.current?.reset();
      setFile(null);
      setBodyText('');
      setOpen(false);
    },
  });
  function selectFile(next: File | undefined) {
    if (!next || mutation.isPending) return;
    try {
      validateImageFile(next);
      setFile(next);
      setFileError('');
      mutation.reset();
    } catch (error) {
      setFileError(apiError(error));
    }
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contentType === 'image' && !file) {
      setFileError('Choose an image to continue.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setProgress(0);
    const metadata = {
      title: String(data.get('title') || ''),
      source_url: String(data.get('source_url') || ''),
      source_name: String(data.get('source_name') || ''),
      source_author: String(data.get('source_author') || ''),
    };
    if (contentType === 'image' && file) mutation.mutate({ ...metadata, file });
    else if (contentType === 'text') mutation.mutate({ ...metadata, body_text: bodyText });
  }
  const error = fileError || (mutation.isError ? apiError(mutation.error) : '');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!mutation.isPending) setOpen(next);
      }}
    >
      <Button
        ref={trigger}
        size="icon"
        variant="outline"
        className="size-[46px] rounded-full bg-muted/95 backdrop-blur-xl dark:bg-muted/95"
        aria-label="Upload meme"
        title="Upload meme"
        disabled={gate.isPending}
        onClick={() => gate.mutate(false)}
      >
        {gate.isPending ? (
          <LoadingIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <PlusIcon aria-hidden="true" />
        )}
      </Button>
      {gate.isError && (
        <p
          role="alert"
          className="absolute bottom-full right-0 mb-3 w-64 text-right text-xs text-destructive"
        >
          {apiError(gate.error)}
        </p>
      )}
      <DialogPanel
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <DialogPanelHeader>
          <DialogTitle>Add a meme</DialogTitle>
          <DialogDescription>Save something worth finding again.</DialogDescription>
        </DialogPanelHeader>
        <form
          ref={form}
          onSubmit={submit}
          aria-busy={mutation.isPending}
          className="flex min-h-0 flex-col"
        >
          <DialogBody>
            <fieldset disabled={mutation.isPending} className="space-y-5">
              <ToggleGroup
                type="single"
                value={contentType}
                spacing={1}
                onValueChange={(value) => {
                  if (value !== 'image' && value !== 'text') return;
                  setContentType(value);
                  setFileError('');
                  mutation.reset();
                }}
                aria-label="Meme type"
                variant="outline"
              >
                <ToggleGroupItem value="image">Image</ToggleGroupItem>
                <ToggleGroupItem value="text">Text</ToggleGroupItem>
              </ToggleGroup>
              {contentType === 'image' ? (
                <div>
                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!mutation.isPending) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      selectFile(event.dataTransfer.files[0]);
                    }}
                    className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed transition-colors focus-within:ring-2 focus-within:ring-ring/50 ${dragging ? 'border-ring bg-accent' : 'border-border bg-muted/30 hover:border-ring hover:bg-accent/50'} ${mutation.isPending ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <Input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label={file ? 'Replace image' : 'Choose an image'}
                      aria-describedby="upload-file-help"
                      className="sr-only h-px w-px border-0 p-0 shadow-none"
                      onChange={(event) => {
                        selectFile(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                    {preview ? (
                      <img
                        src={preview}
                        alt="Selected meme preview"
                        className="pointer-events-none max-h-60 w-full object-contain p-3"
                      />
                    ) : (
                      <div className="pointer-events-none flex flex-col items-center px-5 py-8 text-center">
                        <span className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted">
                          <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-medium">Drop your image here</span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          or click to browse
                        </span>
                      </div>
                    )}
                  </label>
                  <div
                    id="upload-file-help"
                    className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"
                  >
                    {file ? (
                      <>
                        <span className="min-w-0 truncate">
                          {file.name}{' '}
                          <span className="text-muted-foreground">
                            · {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          type="button"
                          className="h-auto p-0 text-[11px] text-muted-foreground"
                          onClick={() => {
                            setFile(null);
                            setFileError('');
                            mutation.reset();
                            fileInput.current?.focus();
                          }}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <span>JPEG, PNG or WebP · Up to 10 MB</span>
                    )}
                  </div>
                </div>
              ) : (
                <label className="block text-xs text-muted-foreground">
                  Text
                  <Textarea
                    name="body_text"
                    value={bodyText}
                    onChange={(event) => {
                      setBodyText(event.target.value);
                      mutation.reset();
                    }}
                    required
                    maxLength={10000}
                    placeholder="Write or paste your meme…"
                    className="mt-2 min-h-48 resize-y"
                  />
                </label>
              )}
              <label className="block text-xs text-muted-foreground">
                Title <span className="text-muted-foreground">(optional)</span>
                <Input className="mt-2" name="title" maxLength={200} placeholder="Give it a name" />
              </label>
              <details className="group rounded-2xl border border-border px-4 py-3">
                <summary className="cursor-pointer text-xs text-muted-foreground transition hover:text-foreground">
                  Add original source <span className="ml-1 text-muted-foreground">(optional)</span>
                </summary>
                <div className="mt-4 space-y-4 pb-1">
                  <label className="block text-xs text-muted-foreground">
                    Source URL
                    <Input
                      className="mt-2"
                      type="url"
                      onInvalid={(event) => {
                        const details = event.currentTarget.closest('details');
                        if (details) details.open = true;
                      }}
                      name="source_url"
                      maxLength={2048}
                      placeholder="https://"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-muted-foreground">
                      Source name
                      <Input
                        className="mt-2"
                        name="source_name"
                        maxLength={200}
                        placeholder="Website or community"
                      />
                    </label>
                    <label className="block text-xs text-muted-foreground">
                      Original creator
                      <Input
                        className="mt-2"
                        name="source_author"
                        maxLength={200}
                        placeholder="Name or handle"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="my-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive"
              >
                {error}
              </p>
            )}
            {mutation.isPending && contentType === 'image' && (
              <div className="my-4">
                <div
                  role="status"
                  className="mb-2 flex justify-between text-xs text-muted-foreground"
                >
                  <span>{progress < 100 ? 'Uploading image…' : 'Verifying and saving…'}</span>
                  <span>{progress}%</span>
                </div>
                <Progress
                  aria-label="Image upload progress"
                  value={progress}
                  max={100}
                  className="h-1"
                />
              </div>
            )}
          </DialogBody>
          <DialogPanelFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || (contentType === 'image' ? !file : !bodyText.trim())}
            >
              {mutation.isPending ? (
                <LoadingIcon
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <ArrowUpIcon aria-hidden="true" />
              )}
              {mutation.isPending ? 'Saving…' : 'Save meme'}
            </Button>
          </DialogPanelFooter>
        </form>
      </DialogPanel>
    </Dialog>
  );
}
