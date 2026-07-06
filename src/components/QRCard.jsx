import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const QR_PREFIX = 'LOOKOUT:';

export default function QRCard({ member, active }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`${QR_PREFIX}${member.id}`, {
      width: 440,
      margin: 1,
      color: { dark: '#10131a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  return (
    <div className="qr-card">
      <div className="qr-card-inner">
        {dataUrl ? (
          <img src={dataUrl} alt={`Lookout QR tag for ${member.name}`} />
        ) : (
          <div className="qr-placeholder" />
        )}
        <div className="qr-meta">
          <div className="qr-name">{member.name}</div>
          <div className="qr-sub">Lookout ID tag · scan if found alone</div>
          <div className="qr-uuid">{member.id}</div>
          <span className={active ? 'badge missing' : 'badge inactive'}>
            {active ? 'Active — report filed' : 'Inactive'}
          </span>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        {dataUrl && (
          <a
            className="btn secondary"
            href={dataUrl}
            download={`lookout-tag-${member.name.replace(/\s+/g, '-').toLowerCase()}.png`}
          >
            Download tag (PNG)
          </a>
        )}
      </div>
    </div>
  );
}
