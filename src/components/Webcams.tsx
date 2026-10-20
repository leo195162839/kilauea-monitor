import { useEffect, useRef, useState } from 'react';
import { POLL_MS, WEBCAMS, type Webcam } from '../config';
import { useNow, usePolling } from '../lib/hooks';
import { formatHst } from '../lib/time';
import { loadImage, type LoadedImage } from '../sources/images';
import { SourceStatus } from './SourceStatus';

// Cameras normally post a new still every few minutes.
const STALE_AFTER_MS = 30 * 60_000;

interface Enlarged {
  cam: Webcam;
  image: LoadedImage;
}

export function Webcams() {
  const [enlarged, setEnlarged] = useState<Enlarged | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (enlarged && !dialog.open) dialog.showModal();
    if (!enlarged && dialog.open) dialog.close();
  }, [enlarged]);

  return (
    <section aria-labelledby="cams-title">
      <div className="section-head">
        <h2 id="cams-title">Summit webcams</h2>
        <p className="section-note">
          At night the regular cameras show only glow; the thermal camera (F1cam) shows heat at any hour.
        </p>
      </div>
      <ul className="cam-grid">
        {WEBCAMS.map((cam) => (
          <li key={cam.code}>
            <WebcamCard cam={cam} onOpen={(image) => setEnlarged({ cam, image })} />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className="cam-dialog"
        onClose={() => setEnlarged(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setEnlarged(null);
        }}
      >
        {enlarged && (
          <figure>
            <img src={enlarged.image.objectUrl} alt={`${enlarged.cam.title}, latest image from ${enlarged.cam.code}`} />
            <figcaption>
              <span>
                {enlarged.cam.title} · {enlarged.cam.code}
                {enlarged.image.lastModified && ` · updated ${formatHst(enlarged.image.lastModified)}`}
              </span>
              <button type="button" className="button" onClick={() => setEnlarged(null)}>
                Close
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}

function WebcamCard({ cam, onOpen }: { cam: Webcam; onOpen: (image: LoadedImage) => void }) {
  const { data, error, refresh } = usePolling((signal) => loadImage(cam.url, signal), POLL_MS.webcams, cam.url);
  const now = useNow();
  const stale = data?.lastModified !== undefined && now - data.lastModified.getTime() > STALE_AFTER_MS;

  return (
    <figure className="card cam">
      <button
        type="button"
        className="cam-frame"
        onClick={() => data && onOpen(data)}
        disabled={!data}
        aria-label={`Enlarge ${cam.title}`}
      >
        {data ? (
          <img src={data.objectUrl} alt={`${cam.title}, latest image from ${cam.code}`} />
        ) : (
          <span className="placeholder-text">{error ? 'Image unavailable' : 'Loading…'}</span>
        )}
      </button>
      <figcaption>
        <span className="cam-title">{cam.title}</span>
        <span className="cam-code">{cam.code}</span>
        <SourceStatus label="Updated" at={data?.lastModified} error={error} onRetry={refresh} />
        {stale && <span className="stale-note">No new image recently. The camera may be offline.</span>}
      </figcaption>
    </figure>
  );
}
