import { VANISH } from '@/lib/config';

/** How long a thread lasts. On edit, the first option leaves it as it is. */
export default function VanishPicker({ id, editing = false, current }: { id: string; editing?: boolean; current?: string | null }) {
  return (
    <select className="input select" id={id} name="vanish" defaultValue="">
      {editing ? <option value="">{current ? 'Keep current timer' : 'Keep (never)'}</option> : <option value="">Never</option>}
      {editing && current && <option value="never">Never</option>}
      {VANISH.map((v) => <option key={v.days} value={String(v.days)}>{editing ? `${v.label} from now` : `After ${v.label}`}</option>)}
    </select>
  );
}
