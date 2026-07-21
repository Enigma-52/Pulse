// Shimmering placeholder rows for table loading states — keeps layout stable
// instead of collapsing to a "Loading..." text row.
export default function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-3">
              <div
                className="h-3 rounded bg-secondary animate-pulse"
                style={{ width: `${55 + ((r * 7 + c * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
