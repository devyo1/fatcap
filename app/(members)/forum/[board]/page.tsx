import { boardBySlug } from '@/lib/config';
import BoardView from './BoardView';

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  return { title: boardBySlug((await params).board)?.name ?? 'Forum' };
}

export default async function Board({ params, searchParams }: { params: Promise<{ board: string }>; searchParams: Promise<{ page?: string; sort?: string }> }) {
  const sp = await searchParams;
  return <BoardView boardSlug={(await params).board} sort={sp.sort} />;
}
