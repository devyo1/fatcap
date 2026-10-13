import { BOARDS, type Sub } from '@/lib/config';

/**
 * One dropdown for where a thread goes, grouped by board. Value "board/sub".
 * `scope`: forum boards only, market only, or everything (admin moves).
 */
export default function PlacePicker({ id, defaultValue, scope = 'forum' }: { id: string; defaultValue?: string; scope?: 'forum' | 'market' | 'all' }) {
  const boards = BOARDS.filter((b) => scope === 'all' || (scope === 'market') === b.market);
  return (
    <select className="input select" id={id} name="place" defaultValue={defaultValue ?? ''} required>
      <option value="" disabled>Select</option>
      {boards.map((b) => (
        <optgroup key={b.slug} label={b.name}>
          {(b.subs as readonly Sub[]).map((s) => <option key={s.slug} value={`${b.slug}/${s.slug}`}>{b.name} / {s.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
