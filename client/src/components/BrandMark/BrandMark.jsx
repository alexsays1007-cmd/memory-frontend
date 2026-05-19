import brandLogo from '../../assets/brand-logo.png';
import './BrandMark.css';

export default function BrandMark({ className = '' }) {
  return (
    <img
      className={`brand-mark ${className}`}
      src={brandLogo}
      alt="In Loop & Light"
      draggable={false}
    />
  );
}
