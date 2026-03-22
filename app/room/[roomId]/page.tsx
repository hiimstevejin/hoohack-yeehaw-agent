import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/rooms/${encodeURIComponent(roomId)}`);
}
