import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const linkClass = ({ isActive }) =>
  isActive ? 'nav-link active' : 'nav-link';

export default function Navbar() {
  const { currentUser, unreadCount, signOut } = useApp();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          Lookout
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {currentUser ? (
            <>
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/found" className={linkClass}>
                I Found Someone
              </NavLink>
              <NavLink to="/map" className={linkClass}>
                Map
              </NavLink>
              <NavLink to="/alerts" className={linkClass}>
                Alerts
                {unreadCount > 0 && <span className="pill">{unreadCount}</span>}
              </NavLink>
              <Link to="/family" className="nav-cta">
                My Family
              </Link>
              <button
                className="nav-link as-button"
                onClick={() => {
                  signOut();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/signup" className="nav-cta">
              Sign up / Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
