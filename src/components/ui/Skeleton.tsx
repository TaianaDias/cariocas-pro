type SkeletonProps = {
  className?: string;
  lines?: number;
};

export function Skeleton({ className = "", lines = 1 }: SkeletonProps) {
  if (lines <= 1) {
    return <span className={`skeleton ${className}`} aria-hidden="true" />;
  }

  return (
    <span className={`skeleton-stack ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span className="skeleton" key={index} />
      ))}
    </span>
  );
}
