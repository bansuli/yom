import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Pipeline.css";
import "./Admin.css";

const SECRET_KEY = "yom_admin_secret";

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
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (key) => {
      const pass = key ?? secret;
      if (!pass) return;
      setBusy(true);
      setErr("");
      try {
        const res = await fetch("/api/admin", { headers: { "x-yom-admin": pass } });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setErr(res.status === 401 ? "wrong secret." : body?.error || "could not load.");
          setData(null);
        } else {
          setData(body);
          try {
            sessionStorage.setItem(SECRET_KEY, pass);
          } catch {
            /* ignore */
          }
        }
      } catch {
        setErr("could not reach the api.");
      }
      setBusy(false);
    },
    [secret]
  );

  useEffect(() => {
    if (secret) load(secret);
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
        <button type="button" onClick={() => load()} disabled={busy}>
          {busy ? "…" : "refresh"}
        </button>
      </header>

      {!data && (
        <form
          className="yom-admin-gate"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label htmlFor="admin-secret">admin secret</label>
          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" disabled={busy}>
            {busy ? "checking…" : "open"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
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
