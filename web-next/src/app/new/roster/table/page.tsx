import { redirect } from 'next/navigation';

export default async function NewRosterTablePage() {
  redirect('/new/roster?view=table');
}
