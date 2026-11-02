import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockAuditLogs } from "@/lib/mock-audit";

function statusBadgeClass(status: string) {
  if (status === "ALLOWED") return "border-success/40 text-success";
  if (status === "BLOCKED") return "border-destructive/40 text-destructive";
  return "border-warning/40 text-warning";
}

export default function AuditPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Every agent decision and payment attempt, on-chain and off-chain.
          </p>
        </div>
        <Button variant="outline">Export</Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAuditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.time}
                </TableCell>
                <TableCell>{log.actor}</TableCell>
                <TableCell className="font-mono text-xs">
                  {log.action}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.resource}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(log.status)}>
                    {log.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
