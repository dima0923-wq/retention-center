import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function PwaCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        <div className="flex gap-3">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-1">
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-10 bg-muted animate-pulse rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PwaLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-9 w-64 bg-muted animate-pulse rounded" />
        <div className="h-9 w-40 bg-muted animate-pulse rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <PwaCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
