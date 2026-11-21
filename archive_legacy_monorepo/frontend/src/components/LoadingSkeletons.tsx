export function Skeleton({ className = "h-4" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded ${className}`} />;
}
export function ChatSkeleton() {
  return <div className="space-y-3 p-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-10 w-1/2 ml-auto" /><Skeleton className="h-10 w-2/3" /></div>;
}
export function ListSkeleton() {
  return <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
}
