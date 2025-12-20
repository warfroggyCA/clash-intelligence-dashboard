import CwlDayPageClient from './CwlDayPageClient';

export default async function CwlDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  return <CwlDayPageClient day={day} />;
}
