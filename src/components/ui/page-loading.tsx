import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-[1rem] bg-black/7", className)} />;
}

function PageHeaderSkeleton({
  showAction = true,
  showMeta = true,
}: {
  showAction?: boolean;
  showMeta?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-7 w-32 rounded-full md:h-8 md:w-40" />
        {showMeta ? <Skeleton className="h-6 w-44 rounded-full" /> : null}
      </div>
      {showAction ? <Skeleton className="h-12 w-full rounded-[1.4rem] md:w-72" /> : null}
    </div>
  );
}

function StatGridSkeleton({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-4 h-10 w-32 rounded-full" />
          <Skeleton className="mt-3 h-3 w-28 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

function ChartCardSkeleton({
  height = "h-[320px]",
}: {
  height?: string;
}) {
  return (
    <Card className={cn("flex flex-col", height)}>
      <Skeleton className="h-5 w-40 rounded-full" />
      <Skeleton className="mt-2 h-3 w-32 rounded-full" />
      <Skeleton className="mt-6 min-h-0 flex-1 rounded-[1.5rem]" />
    </Card>
  );
}

function TableCardSkeleton({
  rows = 6,
  withToolbar = true,
}: {
  rows?: number;
  withToolbar?: boolean;
}) {
  return (
    <Card>
      {withToolbar ? (
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-3 w-64 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-[1.2rem] md:w-64" />
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-3 rounded-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-3 rounded-[1.2rem] border border-black/5 bg-white/50 px-3 py-4">
            <Skeleton className="h-4 w-4/5 rounded-full" />
            <Skeleton className="h-4 w-3/5 rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full justify-self-end" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function FormCardSkeleton({
  blocks = 5,
}: {
  blocks?: number;
}) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-3 w-72 rounded-full" />
        </div>
        {Array.from({ length: blocks }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-[1.1rem]" />
          </div>
        ))}
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
    </Card>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-24 w-full rounded-[1.8rem]" />
      <StatGridSkeleton count={7} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <ChartCardSkeleton height="h-[360px]" />
        <ChartCardSkeleton height="h-[360px]" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <ChartCardSkeleton />
        <TableCardSkeleton rows={4} withToolbar={false} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TableCardSkeleton rows={5} withToolbar={false} />
        <TableCardSkeleton rows={4} withToolbar={false} />
      </div>
    </div>
  );
}

export function EntityListPageSkeleton({
  summaryCards = 0,
}: {
  summaryCards?: number;
}) {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton showAction={false} showMeta={false} />
      {summaryCards > 0 ? <StatGridSkeleton count={summaryCards} /> : null}
      <div className="space-y-6">
        <FormCardSkeleton />
        <TableCardSkeleton />
      </div>
    </div>
  );
}

export function ExpensesPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton showAction={false} showMeta={false} />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-36 rounded-full" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>
      <div className="space-y-6">
        <FormCardSkeleton blocks={4} />
        <TableCardSkeleton rows={7} />
      </div>
    </div>
  );
}

export function DistributionPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton showAction={false} showMeta={false} />
      <Card className="bg-gradient-to-br from-ink/95 via-slate-950/95 to-cobalt/95 text-white">
        <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            <Skeleton className="h-3 w-28 rounded-full bg-white/18" />
            <Skeleton className="h-16 w-56 rounded-full bg-white/18" />
            <Skeleton className="h-3 w-44 rounded-full bg-white/18" />
            <Skeleton className="h-3 w-40 rounded-full bg-white/18" />
          </div>
          <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-5">
            <Skeleton className="h-3 w-32 rounded-full bg-white/18" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-[1.1rem] bg-white/18" />
              ))}
            </div>
          </div>
        </div>
      </Card>
      <div className="space-y-6">
        <FormCardSkeleton blocks={4} />
        <TableCardSkeleton rows={6} />
      </div>
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="hidden gap-3 md:grid md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-10 rounded-[1rem]" />
        ))}
      </div>
      <div className="hidden gap-3 md:grid md:grid-cols-7">
        {Array.from({ length: 35 }).map((_, index) => (
          <Card key={index} className="min-h-[156px] p-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-6 w-full rounded-[0.9rem]" />
              <Skeleton className="h-6 w-4/5 rounded-[0.9rem]" />
              <Skeleton className="h-6 w-3/5 rounded-[0.9rem]" />
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-5 w-28 rounded-full" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-6 w-full rounded-[0.9rem]" />
              <Skeleton className="h-6 w-4/5 rounded-[0.9rem]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton showAction={false} showMeta={false} />
      <StatGridSkeleton count={3} />
      <TableCardSkeleton rows={4} withToolbar={false} />
      <div className="grid gap-6 xl:grid-cols-2">
        <TableCardSkeleton rows={5} withToolbar={false} />
        <TableCardSkeleton rows={5} withToolbar={false} />
      </div>
    </div>
  );
}

export function DashboardChartCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return <ChartCardSkeleton height={cn("h-[360px]", className)} />;
}
