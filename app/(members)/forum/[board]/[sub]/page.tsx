import { placeName } from '@/lib/config';
import BoardView from '../BoardView';

export async function generateMetadata({ params }: { params: Promise<{ board: string; sub: string }> }) {
  const { board, sub } = await params;
  return { title: placeName(board, sub) };
}

export default async function SubBoard({ params, searchParams }: { params: Promise<{ board: string; sub: string }>; searchParams: Promise<{ page?: string; sort?: string }> }) {
  const { board, sub } = await params;
  const sp = await searchParams;
  return <BoardView boardSlug={board} subSlug={sub} page={sp.page} sort={sp.sort} />;
}
