import { getDashboardData } from './get-dashboard-data';
import DashboardClient from './DashboardClient';

export const revalidate = 300; // Revalidate every 5 minutes

export default async function NewDashboardPage() {
  // Fetch directly from Supabase - no HTTP dependency on port configuration
  const initialData = await getDashboardData();

  return <DashboardClient initialData={initialData} />;
}
