const LABELS = {
  active: 'Missing — Active',
  sighted: 'Sighted',
  resolved: 'Found Safe',
  inactive: 'Inactive',
};

const CLASSES = {
  active: 'missing',
  sighted: 'sighted',
  resolved: 'found',
  inactive: 'inactive',
};

// Pass a report: shows "Sighted" when active with at least one sighting.
export default function StatusBadge({ report, status }) {
  let key = status;
  if (report) {
    key =
      report.status === 'active'
        ? report.sightings?.length > 0
          ? 'sighted'
          : 'active'
        : 'resolved';
  }
  return (
    <span className={`badge ${CLASSES[key] || key}`}>
      {LABELS[key] || key}
    </span>
  );
}
