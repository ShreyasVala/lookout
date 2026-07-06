import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Camera QR scanner with an image-upload fallback for devices
// without a camera. Calls onScan(decodedText) once per successful read.
export default function Scanner({ onScan }) {
  const idRef = useRef(
    `qr-reader-${Math.random().toString(36).slice(2, 9)}`
  );
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const [cameraError, setCameraError] = useState('');
  const [fileError, setFileError] = useState('');

  const stopScanner = () => {
    try {
      const result = scannerRef.current?.stop?.();
      result?.catch?.(() => {});
    } catch {
      // html5-qrcode can throw if stop is called after it already stopped.
    }
  };

  const emitScan = (text) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    stopScanner();
    onScanRef.current(text);
  };

  useEffect(() => {
    const scanner = new Html5Qrcode(idRef.current);
    scannerRef.current = scanner;
    let active = true;
    let started = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          emitScan(text);
        },
        () => {
          // per-frame decode misses — ignore
        }
      )
      .then(() => {
        started = true;
        if (!active) {
          scanner.stop().catch(() => {});
        }
      })
      .catch((err) => {
        if (active) {
          setCameraError(
            'Camera unavailable (permission denied or no camera). You can upload a photo of the QR tag instead.'
          );
        }
      });

    return () => {
      active = false;
      if (started) {
        try {
          const result = scanner.stop();
          result
            .then(() => scanner.clear())
            .catch(() => {
              try {
                scanner.clear();
              } catch {
                // Already cleared or not fully initialized.
              }
            });
        } catch {
          try {
            scanner.clear();
          } catch {
            // Already cleared or not fully initialized.
          }
        }
      }
    };
  }, []);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || hasScannedRef.current) return;
    setFileError('');
    try {
      // A separate instance avoids interfering with the camera stream.
      const fileScanner = new Html5Qrcode(`${idRef.current}-file`);
      const text = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      emitScan(text);
    } catch {
      setFileError('Could not read a QR code from that image.');
    }
  };

  return (
    <div className="scanner">
      <div id={idRef.current} className="scanner-view" />
      {cameraError && <div className="error-text">{cameraError}</div>}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="qr-file">Or upload a photo of the tag</label>
        <input id="qr-file" type="file" accept="image/*" onChange={onFile} />
        {fileError && <div className="error-text">{fileError}</div>}
      </div>
      <div id={`${idRef.current}-file`} style={{ display: 'none' }} />
    </div>
  );
}
