import { NavLink } from "react-router-dom";

export function PnmPeople({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.4" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.8 18.2c.8-2.6 2.6-4 5.1-4s4.3 1.4 5.1 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13.2 18.2c.6-2 1.9-3.2 3.8-3.2 1.9 0 3.2 1.2 3.8 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function YomNav({ active = "y" }) {
  return (
    <nav className="yom-nav" aria-label="yom">
      <NavLink to="/lineup" className={({ isActive }) => (isActive || active === "lineup" ? "on" : "")}>
        <span className="yom-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4.6a1.7 1.7 0 0 1 1.7 1.7c0 .7-.4 1.2-1.1 1.5L9.2 9.4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M3.6 18.4h16.8L12 8.6 3.6 18.4Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        my lineup
      </NavLink>
      <NavLink to="/everyone" className={({ isActive }) => (isActive || active === "everyone" ? "on" : "")}>
        <span className="yom-nav-ico" aria-hidden="true">
          <PnmPeople size={22} />
        </span>
        everyone
      </NavLink>
      <NavLink
        to="/looks"
        className={({ isActive }) => `yom-nav-y${isActive || active === "y" ? " on" : ""}`}
        aria-label="yom"
      >
        <span className="yom-nav-y-mark">y</span>
        yom
      </NavLink>
    </nav>
  );
}
