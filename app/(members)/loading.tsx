/** Shown the moment you tap through to another page, until it arrives. Fades in late, so quick pages never flash it. */
export default function Loading() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <span className="sk sk-title" />
      <span className="sk sk-line" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="sk-row">
          <span className="sk sk-av" />
          <span className="sk-col">
            <span className="sk sk-t" />
            <span className="sk sk-ex" />
            <span className="sk sk-m" />
          </span>
        </div>
      ))}
    </div>
  );
}
