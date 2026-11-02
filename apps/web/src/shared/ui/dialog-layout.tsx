import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/utils';
import { DialogContent, DialogHeader, DialogFooter } from './dialog';

function DialogPanel({
  size = 'default',
  className,
  ...props
}: ComponentProps<typeof DialogContent> & { size?: 'default' | 'wide' }) {
  return (
    <DialogContent
      className={cn(
        'flex max-h-[90dvh] flex-col overflow-hidden gap-0 border-0 p-0',
        size === 'wide' && 'h-[80dvh] sm:max-w-4xl',
        className,
      )}
      {...props}
    />
  );
}

function DialogPanelHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader className={cn('shrink-0 px-6 pt-6 pb-4 pr-12 text-left', className)} {...props} />
  );
}

function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2', className)}
      {...props}
    />
  );
}

function DialogPanelFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn('shrink-0 border-0 px-6 pt-4 pb-6', className)} {...props} />;
}

export { DialogPanel, DialogPanelHeader, DialogBody, DialogPanelFooter };
