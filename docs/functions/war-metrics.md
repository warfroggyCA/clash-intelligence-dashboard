# war-metrics.ts

Compute and analyze war performance from logs and current status.

## Types
- `WarData`, `WarMetrics`, `MemberWarPerformance`, `WarAlert`

## Exports
- `calculateTimeRemaining(endTime?: string): string | null`
- `calculateWarPerformance(warLog?: Array<any>): { last10Wars, trend }`
- `analyzeMemberWarPerformance(members: Member[], teamSize?: number): MemberWarPerformance[]`
- `calculateWarMetrics(members: Member[], warData?: WarData): WarMetrics`
- `generateWarAlerts(warMetrics: WarMetrics, members: Member[]): WarAlert[]`
- `getTopWarPerformers(memberPerformance, limit=5)`
- `getMembersNeedingCoaching(memberPerformance)`

## Example

```ts
import { calculateWarMetrics, generateWarAlerts } from '@/lib/war-metrics';

const metrics = calculateWarMetrics(members, warData);
const alerts = generateWarAlerts(metrics, members);
```
