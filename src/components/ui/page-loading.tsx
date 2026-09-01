import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SkeletonBlock({
  className,
  tone = "light",
  style,
}: {
  className?: string;
  tone?: "light" | "dark";
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "skeleton skeleton-soft rounded-[1rem]",
        tone === "dark" && "skeleton-dark",
        className,
      )}
    />
  );
}

function HeaderSkeleton({
  withControls = false,
  withMeta = true,
}: {
  withControls?: boolean;
  withMeta?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-3">
        <SkeletonBlock className="h-6 w-28 rounded-full md:h-7 md:w-36" />
        {withMeta ? <SkeletonBlock className="h-5 w-40 rounded-full" /> : null}
      </div>
      {withControls ? (
        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[22rem] md:items-end">
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-10 w-24 rounded-full" />
            <SkeletonBlock className="h-10 w-28 rounded-full" />
            <SkeletonBlock className="h-10 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-12 w-full rounded-[1.35rem] md:w-[22rem]" />
        </div>
      ) : null}
    </div>
  );
}

function KpiCardSkeleton({
  emphasized = false,
}: {
  emphasized?: boolean;
}) {
  return (
    <Card className={cn("relative overflow-hidden", emphasized && "bg-[linear-gradient(135deg,rgba(245,248,255,0.95),rgba(255,255,255,0.92))]")}>
      <div className="flex items-start justify-between gap-3">
        <SkeletonBlock className="h-3 w-28 rounded-full" />
        <SkeletonBlock className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonBlock className="mt-5 h-10 w-32 rounded-full md:h-12 md:w-36" />
      <div className="mt-4 flex items-center gap-2">
        <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
        <SkeletonBlock className="h-3 w-28 rounded-full" />
      </div>
    </Card>
  );
}

function AlertsBannerSkeleton() {
  return (
    <Card className="border-black/5 bg-[linear-gradient(135deg,rgba(255,252,246,0.98),rgba(255,255,255,0.96))]">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <SkeletonBlock className="h-11 w-11 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <SkeletonBlock className="h-3 w-28 rounded-full" />
            <SkeletonBlock className="h-8 w-72 max-w-full rounded-full" />
            <SkeletonBlock className="h-3 w-full max-w-[34rem] rounded-full" />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.45rem] border border-black/5 bg-white/88 p-4">
              <SkeletonBlock className="h-3 w-24 rounded-full" />
              <SkeletonBlock className="mt-3 h-9 w-28 rounded-full" />
              <div className="mt-3 space-y-2">
                <SkeletonBlock className="h-3 w-full rounded-full" />
                <SkeletonBlock className="h-3 w-4/5 rounded-full" />
              </div>
              <SkeletonBlock className="mt-5 h-10 w-32 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ChartAreaSkeleton({
  tall = false,
  className,
}: {
  tall?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", tall ? "h-[360px]" : "h-[320px]", className)}>
      <div className="space-y-2">
        <SkeletonBlock className="h-5 w-40 rounded-full" />
        <SkeletonBlock className="h-3 w-32 rounded-full" />
      </div>
      <div className="relative mt-6 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-black/5 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.82))] p-4">
        <div className="absolute inset-x-4 top-6 space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-px bg-black/6" />
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className="w-full rounded-[0.8rem] rounded-b-[1.1rem]"
              style={{ height: `${48 + ((index * 17) % 88)}px` }}
            />
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <div className="relative h-[70%]">
            <div className="absolute inset-x-0 bottom-8 h-[2px] rounded-full bg-black/6" />
            <div className="absolute inset-x-0 bottom-14 flex items-center justify-between">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <SkeletonBlock className="h-3 w-3 rounded-full" />
                  <SkeletonBlock className="h-2 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TableSkeleton({
  rows = 6,
  columns = 5,
  withToolbar = true,
}: {
  rows?: number;
  columns?: number;
  withToolbar?: boolean;
}) {
  return (
    <Card>
      {withToolbar ? (
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-40 rounded-full" />
            <SkeletonBlock className="h-3 w-72 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <SkeletonBlock className="h-10 w-24 rounded-full" />
            <SkeletonBlock className="h-10 w-28 rounded-full" />
            <SkeletonBlock className="h-10 w-32 rounded-[1rem]" />
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBlock key={index} className="h-3 rounded-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-3 rounded-[1.25rem] border border-black/5 bg-white/60 px-4 py-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <SkeletonBlock
                key={columnIndex}
                className={cn(
                  "h-4 rounded-full",
                  columnIndex === 0 && "w-4/5",
                  columnIndex === columns - 1 && "w-16 justify-self-end",
                  columnIndex !== 0 && columnIndex !== columns - 1 && "w-3/4",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function FormSkeleton({
  blocks = 5,
}: {
  blocks?: number;
}) {
  return (
    <Card>
      <div className="space-y-5">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-40 rounded-full" />
          <SkeletonBlock className="h-3 w-80 max-w-full rounded-full" />
        </div>
        {Array.from({ length: blocks }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <SkeletonBlock className="h-11 w-full rounded-[1.1rem]" />
          </div>
        ))}
        <div className="flex gap-3">
          <SkeletonBlock className="h-11 w-36 rounded-full" />
          <SkeletonBlock className="h-11 w-24 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

function DistributionHeroSkeleton() {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-ink via-slate-950 to-cobalt text-white">
      <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <SkeletonBlock tone="dark" className="h-3 w-28 rounded-full" />
          <SkeletonBlock tone="dark" className="h-16 w-64 rounded-full md:h-20 md:w-80" />
          <div className="space-y-2">
            <SkeletonBlock tone="dark" className="h-3 w-44 rounded-full" />
            <SkeletonBlock tone="dark" className="h-3 w-36 rounded-full" />
            <SkeletonBlock tone="dark" className="h-3 w-40 rounded-full" />
          </div>
        </div>
        <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-5">
          <SkeletonBlock tone="dark" className="h-3 w-32 rounded-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <SkeletonBlock tone="dark" className="h-3 w-24 rounded-full" />
                <SkeletonBlock tone="dark" className="h-7 w-24 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
            <SkeletonBlock tone="dark" className="h-3 w-36 rounded-full" />
            <SkeletonBlock tone="dark" className="mt-3 h-11 w-40 rounded-full" />
            <div className="mt-4 space-y-2">
              <SkeletonBlock tone="dark" className="h-3 w-full rounded-full" />
              <SkeletonBlock tone="dark" className="h-3 w-5/6 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withControls withMeta />
      <AlertsBannerSkeleton />
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <KpiCardSkeleton key={index} emphasized={index === 0 || index === 3} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <ChartAreaSkeleton tall />
        <ChartAreaSkeleton tall />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <ChartAreaSkeleton />
        <TableSkeleton rows={4} columns={2} withToolbar={false} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TableSkeleton rows={5} columns={6} withToolbar={false} />
        <TableSkeleton rows={4} columns={2} withToolbar={false} />
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
      <HeaderSkeleton />
      {summaryCards > 0 ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: summaryCards }).map((_, index) => (
            <KpiCardSkeleton key={index} emphasized={index === 0} />
          ))}
        </div>
      ) : null}
      <div className="space-y-6">
        <FormSkeleton />
        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}

export function ExpensesPageSkeleton() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton />
      <div className="flex gap-2">
        <SkeletonBlock className="h-11 w-36 rounded-full" />
        <SkeletonBlock className="h-11 w-36 rounded-full" />
      </div>
      <div className="space-y-6">
        <FormSkeleton blocks={4} />
        <TableSkeleton rows={7} columns={6} />
      </div>
    </div>
  );
}

export function DistributionPageSkeleton() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton />
      <DistributionHeroSkeleton />
      <div className="space-y-6">
        <FormSkeleton blocks={4} />
        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton withControls withMeta={false} />
      <div className="hidden gap-3 md:grid md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-[1.1rem] border border-black/5 bg-white/50 px-3 py-3">
            <SkeletonBlock className="h-3 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <div className="hidden gap-3 md:grid md:grid-cols-7">
        {Array.from({ length: 35 }).map((_, index) => (
          <Card key={index} className="min-h-[164px] p-3">
            <div className="flex items-start justify-between">
              <SkeletonBlock className="h-7 w-7 rounded-full" />
              <SkeletonBlock className="h-4 w-12 rounded-full" />
            </div>
            <div className="mt-5 space-y-2.5">
              <SkeletonBlock className="h-5 w-full rounded-[0.85rem]" />
              <SkeletonBlock className="h-5 w-4/5 rounded-[0.85rem]" />
              <SkeletonBlock className="h-5 w-3/5 rounded-[0.85rem]" />
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index}>
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-5 w-28 rounded-full" />
              <SkeletonBlock className="h-4 w-12 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <SkeletonBlock className="h-5 w-full rounded-[0.85rem]" />
              <SkeletonBlock className="h-5 w-4/5 rounded-[0.85rem]" />
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
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <KpiCardSkeleton key={index} emphasized={index === 0} />
        ))}
      </div>
      <TableSkeleton rows={4} columns={5} withToolbar={false} />
      <div className="grid gap-6 xl:grid-cols-2">
        <TableSkeleton rows={5} columns={4} withToolbar={false} />
        <TableSkeleton rows={5} columns={5} withToolbar={false} />
      </div>
    </div>
  );
}

export function DashboardChartCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return <ChartAreaSkeleton className={className} tall={!className?.includes("320")} />;
}
