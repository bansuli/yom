import { NavLink } from "react-router-dom";

export function PnmPeople({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9.4" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 18.9c0-3.1 2.7-5.1 5.9-5.1s5.9 2 5.9 5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16.4 5.5a3 3 0 0 1 0 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.8 14.2c1.8.6 2.9 2.2 2.9 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
              d="M12 9.6V8.1a1.75 1.75 0 1 0-1.75-1.75"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 9.6 4.3 16.3a1 1 0 0 0 .66 1.75h14.08a1 1 0 0 0 .66-1.75L12 9.6Z"
              stroke="currentColor"
              strokeWidth="1.7"
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
      <NavLink to="/me" className={({ isActive }) => (isActive || active === "me" ? "on" : "")}>
        <span className="yom-nav-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8.4" r="3.4" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M5.2 19.5c0-3.4 3-5.6 6.8-5.6s6.8 2.2 6.8 5.6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        you
      </NavLink>
    </nav>
  );
}
