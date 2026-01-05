"use client";

import Card from "@/components/new-ui/Card";
import CapitalAnalyticsDashboard from "@/components/capital/CapitalAnalyticsDashboard";

export default function CapitalRaidsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Capital Raids
          </h1>
          <p className="text-sm text-slate-400">
            Track raid weekend impact across loot efficiency, carry scores, participation, and ROI.
          </p>
        </div>
      </Card>

      <CapitalAnalyticsDashboard publicAccess showRosterToggle rosterOnlyDefault />
    </div>
  );
}
