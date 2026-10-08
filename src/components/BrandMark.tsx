import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/studygram-192.png" width={192} height={192} alt="StudyGram" className={cn('shrink-0 rounded-[24%] object-cover', className)} draggable={false} />;
}
