import BrandMark from '../BrandMark/BrandMark';
import './Header.css';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <BrandMark />
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
