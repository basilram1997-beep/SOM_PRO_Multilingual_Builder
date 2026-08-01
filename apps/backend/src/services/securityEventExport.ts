type SecurityEvent = {
  timestamp: string;
  schoolId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  accessResult: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type SecurityEventExporter = {
  format: "jsonl" | "syslog";
  export(events: SecurityEvent[]): string;
};

function toJsonLine(event: SecurityEvent) {
  return JSON.stringify(event);
}

export const jsonlSecurityEventExporter: SecurityEventExporter = {
  format: "jsonl",
  export(events) {
    return events.map(toJsonLine).join("\n");
  }
};

export function mapAuditLogToSecurityEvent(input: {
  createdAt: Date;
  schoolId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  accessResult?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): SecurityEvent {
  return {
    timestamp: input.createdAt.toISOString(),
    schoolId: input.schoolId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    accessResult: input.accessResult ?? null,
    path: input.path ?? null,
    method: input.method ?? null,
    statusCode: input.statusCode ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null
  };
}

export function exportSecurityEventsAsJsonl(events: SecurityEvent[]) {
  return jsonlSecurityEventExporter.export(events);
}
