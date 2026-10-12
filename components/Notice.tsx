export default function Notice({ error, ok }: { error?: string | string[]; ok?: string }) {
  const e = Array.isArray(error) ? error[0] : error;
  if (e) return <p className="notice err mono" role="alert">{e}</p>;
  if (ok) return <p className="notice mono" role="status">{ok}</p>;
  return null;
}
