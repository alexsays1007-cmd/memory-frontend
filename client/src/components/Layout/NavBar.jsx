import { NavLink } from 'react-router-dom';
import './NavBar.css';

const navItems = [
  { path: '/', label: 'Memories' },
  { path: '/diary', label: 'Diary' },
  { path: '/consciousness', label: 'Consciousness' },
];

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
