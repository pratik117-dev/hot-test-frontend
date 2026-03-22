import clsx from 'clsx';

interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; className?: string; }

const sizeMap = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-3', lg: 'w-12 h-12 border-4' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div className={clsx('border-brand-500 border-t-transparent rounded-full animate-spin', sizeMap[size], className)} />
  );
}

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
        {description && <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">{description}</p>}
      </div>
    </div>
  );
}
