import BrandMark from '../BrandMark/BrandMark';
import './Header.css';

function ConsoleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h8" />
      <path d="M16 7h4" />
      <path d="M14 5v4" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <path d="M10 15v4" />
    </svg>
  );
}

export default function Header({ onOpenConsole }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <BrandMark />
        <div className="brand-text">
          <h1 className="brand-title">In Loop & Light</h1>
          <span className="brand-subtitle">private memory archive</span>
        </div>
      </div>
      <div className="header-right">
        <div className="header-slogan">
          our memories, softly kept ♡
        </div>
        <button className="header-console-button" type="button" onClick={onOpenConsole} aria-label="Open system console" title="控制台">
          <ConsoleIcon />
        </button>
      </div>
    </header>
  );
}
