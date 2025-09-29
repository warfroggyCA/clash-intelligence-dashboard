"use client";

// TEST 11: Absolute minimal component with no props, no logic, no structure
export default function ClientDashboard() {
  console.log('[ClientDashboard] TEST 11 - ABSOLUTE MINIMAL COMPONENT');

  return (
    <div>
      <h1>TEST 11: ABSOLUTE MINIMAL COMPONENT</h1>
      <p>No props, no logic, no structure - just basic HTML</p>
    </div>
  );
}