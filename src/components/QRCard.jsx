import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const QR_PREFIX = 'LOOKOUT:';

export default function QRCard({ member, active }) {
  const [dataUrl, setDataUrl] = useState('');
  const [tagUrl, setTagUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const tagText = `${QR_PREFIX}${member.id}`;
    QRCode.toDataURL(tagText, {
      width: 440,
      margin: 1,
      color: { dark: '#10131a', light: '#ffffff' },
    })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);

        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = 720;
          canvas.height = 920;
          const ctx = canvas.getContext('2d');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = '#10131a';
          ctx.font = '700 38px Inter, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Lookout ID Tag', canvas.width / 2, 70);

          ctx.font = '600 30px Inter, Arial, sans-serif';
          ctx.fillText(member.name, canvas.width / 2, 118);

          ctx.drawImage(img, 140, 155, 440, 440);

          ctx.fillStyle = '#3f4650';
          ctx.font = '500 24px Inter, Arial, sans-serif';
          ctx.fillText('Scan if found alone', canvas.width / 2, 650);

          ctx.fillStyle = '#10131a';
          ctx.font = '700 22px ui-monospace, SFMono-Regular, Consolas, monospace';
          wrapCenteredText(ctx, member.id, canvas.width / 2, 710, 600, 28);

          ctx.fillStyle = '#6b7280';
          ctx.font = '500 18px Inter, Arial, sans-serif';
          ctx.fillText('Manual lookup ID printed above', canvas.width / 2, 812);
          ctx.fillText('Demo project - contact local police in an emergency', canvas.width / 2, 850);

          setTagUrl(canvas.toDataURL('image/png'));
        };
        img.src = url;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [member.id, member.name]);

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
        {(tagUrl || dataUrl) && (
          <a
            className="btn secondary"
            href={tagUrl || dataUrl}
            download={`lookout-tag-${member.name.replace(/\s+/g, '-').toLowerCase()}.png`}
          >
            Download tag (PNG)
          </a>
        )}
      </div>
    </div>
  );
}

function wrapCenteredText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).match(/.{1,24}/g) || [''];
  words.forEach((line, index) => {
    let candidate = line;
    while (ctx.measureText(candidate).width > maxWidth && candidate.length > 4) {
      candidate = candidate.slice(0, -1);
    }
    ctx.fillText(candidate, x, y + index * lineHeight);
  });
}
