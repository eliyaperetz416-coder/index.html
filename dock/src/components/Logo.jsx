export default function Logo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--surface-2)" />
      <rect x="14" y="40" width="36" height="6" rx="3" fill="var(--accent)" />
      <rect x="18" y="18" width="10" height="18" rx="3" fill="var(--text)" opacity=".9" />
      <rect x="31" y="24" width="10" height="12" rx="3" fill="var(--text)" opacity=".55" />
    </svg>
  );
}
