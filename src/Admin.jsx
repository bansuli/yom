import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Pipeline.css";
import "./Admin.css";

const SECRET_KEY = "yom_admin_secret";
const TOKEN_KEY = "yom_admin_token";

function when(value) {
  if (!value) return "—";
  const at = new Date(value);
  if (Number.isNaN(at.valueOf())) return "—";
  return at.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Admin() {
  const [secret, setSecret] = useState(() => {
    try {
      return sessionStorage.getItem(SECRET_KEY) || "";
    } catch {
      return "";
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useSecret, setUseSecret] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (creds) => {
      const bearer = creds?.token ?? token;
      const pass = creds?.secret ?? secret;
      if (!bearer && !pass) return;
      setBusy(true);
      setErr("");
      try {
        const res = await fetch("/api/admin", {
          headers: bearer ? { authorization: `Bearer ${bearer}` } : { "x-yom-admin": pass },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setErr(res.status === 401 ? "that login didn’t work." : body?.error || "could not load.");
          setData(null);
          if (res.status === 401 && bearer) {
            setToken("");
            try {
              sessionStorage.removeItem(TOKEN_KEY);
            } catch {
              /* ignore */
            }
          }
        } else {
          setData(body);
          try {
            if (bearer) sessionStorage.setItem(TOKEN_KEY, bearer);
            else sessionStorage.setItem(SECRET_KEY, pass);
          } catch {
            /* ignore */
          }
        }
      } catch {
        setErr("could not reach the api.");
      }
      setBusy(false);
    },
    [secret, token]
  );

  const logIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok || !res.access_token) {
      setErr(res?.error || "could not log in.");
      return;
    }
    setPassword("");
    setToken(res.access_token);
    load({ token: res.access_token });
  };

  useEffect(() => {
    if (token) load({ token });
    else if (secret) load({ secret });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = data?.totals;

  return (
    <div className="yom-admin">
      <header className="yom-admin-head">
        <Link to="/looks" className="pnm-back">
          ← app
        </Link>
        <b>yom · who we have</b>
        {data && (
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/admin?csv=1", {
                headers: token ? { authorization: `Bearer ${token}` } : { "x-yom-admin": secret },
              });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "yom-people.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            csv
          </button>
        )}
        <button type="button" onClick={() => load()} disabled={busy}>
          {busy ? "…" : "refresh"}
        </button>
      </header>

      {!data && !useSecret && (
        <form className="yom-admin-gate" onSubmit={logIn}>
          <label htmlFor="admin-email">email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <label htmlFor="admin-password">password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy}>
            {busy ? "checking…" : "log in"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
          <button type="button" className="yom-admin-alt" onClick={() => setUseSecret(true)}>
            use the shared secret instead
          </button>
        </form>
      )}

      {!data && useSecret && (
        <form
          className="yom-admin-gate"
          onSubmit={(e) => {
            e.preventDefault();
            load({ secret });
          }}
        >
          <label htmlFor="admin-secret">admin secret</label>
          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" disabled={busy}>
            {busy ? "checking…" : "open"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
          <button type="button" className="yom-admin-alt" onClick={() => setUseSecret(false)}>
            ← log in with my email
          </button>
        </form>
      )}

      {totals && (
        <>
          <div className="yom-admin-tiles">
            <article>
              <b>{totals.people}</b>
              <span>people with an email</span>
            </article>
            <article>
              <b>{totals.people_today}</b>
              <span>joined today</span>
            </article>
            <article>
              <b>{totals.visitors_no_email_today}</b>
              <span>opened today, no email</span>
            </article>
            <article>
              <b>{totals.with_lineup}</b>
              <span>built a lineup</span>
            </article>
            <article>
              <b>{totals.public_lineups}</b>
              <span>shared it</span>
            </article>
            <article>
              <b>{totals.looks_total}</b>
              <span>looks scanned</span>
            </article>
          </div>

          <div className="yom-admin-campaigns">
            {Object.entries(data.by_campaign || {}).map(([name, count]) => (
              <span key={name}>
                {name} <b>{count}</b>
              </span>
            ))}
          </div>

          {err && <p className="yom-admin-err">{err}</p>}

          <div className="yom-admin-table">
            <table>
              <thead>
                <tr>
                  <th>email</th>
                  <th>name</th>
                  <th>campaign</th>
                  <th>first seen</th>
                  <th>looks</th>
                  <th>lineup</th>
                </tr>
              </thead>
              <tbody>
                {(data.people || []).map((p) => (
                  <tr key={p.email}>
                    <td>{p.email}</td>
                    <td>{p.name || "—"}</td>
                    <td>{p.campaign || "—"}</td>
                    <td>{when(p.first_seen)}</td>
                    <td>{p.looks || 0}</td>
                    <td>{p.is_public ? "public" : p.in_lineup ? `${p.in_lineup}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
