import {
  STATE_LABEL,
  serviceHealth,
  type Snapshot,
} from "@/lib/monitoring/snapshot";
import { HealthBadge } from "./health-badge";

/**
 * Every tracked service with its state, as a real table. It is also the text
 * alternative to the particle field, so it carries everything the field shows.
 */
export function ServiceTable({
  snapshot,
  stale,
  caption,
}: {
  snapshot: Snapshot;
  stale: boolean;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-data w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-line border-b">
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              Service
            </th>
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              State
            </th>
            <th
              scope="col"
              className="text-muted hidden py-2 font-medium sm:table-cell"
            >
              Unit
            </th>
          </tr>
        </thead>
        <tbody>
          {snapshot.services.map((s) => (
            <tr key={s.id} data-service={s.id} className="border-line border-b">
              <th scope="row" className="py-3 pr-4 font-medium">
                {s.name}
              </th>
              <td className="py-3 pr-4">
                <HealthBadge
                  health={serviceHealth(s.state, stale)}
                  label={stale ? undefined : STATE_LABEL[s.state]}
                />
              </td>
              <td className="text-muted hidden py-3 font-mono sm:table-cell">
                {s.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
