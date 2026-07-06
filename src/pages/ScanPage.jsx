import { Navigate } from 'react-router-dom';

// Tag scanning now lives inside the unified "I Found Someone" page.
export default function ScanPage() {
  return <Navigate to="/found" replace />;
}
