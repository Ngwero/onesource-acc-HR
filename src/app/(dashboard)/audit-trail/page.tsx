"use client";

import { ModuleListPage } from "@/components/modules/module-list-page";
import { formatDate } from "@/lib/utils";

export default function AuditTrailPage() {
  return (
    <ModuleListPage
      title="Audit Trail"
      description="System activity and change history"
      apiEndpoint="/api/audit"
      columns={[
        {
          key: "createdAt",
          header: "Date/Time",
          render: (item) => formatDate(String(item.createdAt)),
        },
        {
          key: "user",
          header: "User",
          render: (item) => String((item.user as { fullName?: string })?.fullName || "System"),
        },
        { key: "action", header: "Action" },
        { key: "module", header: "Module" },
        { key: "recordId", header: "Record ID" },
      ]}
    />
  );
}
