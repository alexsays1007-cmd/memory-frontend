import './Header.css';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-mark-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {/* Simple deer/otter abstract placeholder */}
            <path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z" strokeDasharray="2 4"/>
            <path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div className="brand-text">
          <h1 className="brand-title">In Loop & Light</h1>
          <span className="brand-subtitle">private memory archive</span>
        </div>
      </div>
      <div className="header-slogan">
        our memories, softly kept ♡
      </div>
    </header>
  );
}
