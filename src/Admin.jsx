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

function ago(value) {
  const at = value ? new Date(value) : null;
  if (!at || Number.isNaN(at.valueOf())) return "—";
  const mins = Math.round((Date.now() - at.valueOf()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** A heading over an empty box is noise; a section with nothing in it hides. */
function Section({ title, note, children, show = true }) {
  if (!show) return null;
  return (
    <section className="yom-admin-section">
      <h2 className="yom-admin-h">{title}</h2>
      {note && <p className="yom-admin-note">{note}</p>}
      {children}
    </section>
  );
}

function Chips({ data, extra }) {
  const entries = Object.entries(data || {}).filter(([, count]) => count);
  if (!entries.length && !extra) return null;
  return (
    <div className="yom-admin-campaigns">
      {entries.map(([name, count]) => (
        <span key={name}>
          {name} <b>{count}</b>
        </span>
      ))}
      {extra}
    </div>
  );
}

/** The gap between two steps is the thing worth fixing, so show the gap. */
function Funnel({ steps }) {
  const top = steps[0]?.people || 0;
  return (
    <div className="yom-funnel">
      {steps.map((step, i) => {
        const prev = i ? steps[i - 1].people : step.people;
        const lost = Math.max(0, prev - step.people);
        const width = top ? Math.max(3, Math.round((step.people / top) * 100)) : 3;
        return (
          <div className="yom-funnel-row" key={step.step}>
            <span className="yom-funnel-label">{step.step}</span>
            <span className="yom-funnel-bar">
              <i style={{ width: `${width}%` }} />
            </span>
            <b>{step.people}</b>
            <em>{i && lost ? `−${lost}` : ""}</em>
          </div>
        );
      })}
    </div>
  );
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
  const [showInternal, setShowInternal] = useState(false);
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("all");
  const [open, setOpen] = useState(null);
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
        const withInternal = creds?.internal ?? showInternal;
        const win = creds?.range ?? range;
        const qs = `?window=${encodeURIComponent(win)}${withInternal ? "&internal=1" : ""}`;
        const res = await fetch(`/api/admin${qs}`, {
          headers: bearer ? { authorization: `Bearer ${bearer}` } : { "x-yom-admin": pass },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          setErr(res.status === 401 ? "That login didn’t work." : body?.error || "Could not load.");
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
        setErr("Could not reach the API.");
      }
      setBusy(false);
    },
    [secret, token, showInternal, range]
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
      setErr(res?.error || "Could not log in.");
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
  const rangeLabel = { "24h": "last 24h", "7d": "last 7 days", all: "all time" }[range] || "all time";
  const some = (obj) => Object.values(obj || {}).some(Boolean);
  const hasInputs = some(data?.by_input) || data?.avg_score != null;
  const hasRounds = some(data?.by_round);
  const hasCampaigns = some(data?.by_campaign);
  const stuckTotal =
    (data?.stuck?.no_scan?.length || 0) +
    (data?.stuck?.scanned_no_lineup?.length || 0) +
    (data?.stuck?.lineup_not_shared?.length || 0);
  const person = open ? (data?.people || []).find((p) => p.email === open) : null;

  const downloadCsv = async () => {
    const res = await fetch(`/api/admin?csv=1&window=${range}${showInternal ? "&internal=1" : ""}`, {
      headers: token ? { authorization: `Bearer ${token}` } : { "x-yom-admin": secret },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yom-people.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="yom-admin">
      <header className="yom-admin-head">
        <Link to="/looks" className="pnm-back">
          ← App
        </Link>
        <b>yom admin</b>
        {data && (
          <button type="button" onClick={downloadCsv}>
            Export CSV
          </button>
        )}
        <button type="button" onClick={() => load()} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </button>
      </header>

      {!data && !useSecret && (
        <form className="yom-admin-gate" onSubmit={logIn}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Log in"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
          <button type="button" className="yom-admin-alt" onClick={() => setUseSecret(true)}>
            Use the shared secret instead
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
          <label htmlFor="admin-secret">Admin secret</label>
          <input
            id="admin-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Open"}
          </button>
          {err && <p className="yom-admin-err">{err}</p>}
          <button type="button" className="yom-admin-alt" onClick={() => setUseSecret(false)}>
            ← Log in with my email
          </button>
        </form>
      )}

      {totals && (
        <>
          <nav className="yom-admin-tabs">
            {[
              ["overview", "Overview"],
              ["people", `People · ${totals.people}`],
              ["activity", "Activity"],
              ["issues", `Issues${data.errors_recent ? ` · ${data.errors_recent}` : ""}`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "on" : ""}
                onClick={() => {
                  setTab(id);
                  setOpen(null);
                }}
              >
                {label}
              </button>
            ))}
            <span className="yom-admin-range">
              {[
                ["24h", "Last 24h"],
                ["7d", "Last 7 days"],
                ["all", "All time"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={range === id ? "on" : ""}
                  onClick={() => {
                    setRange(id);
                    load({ range: id });
                  }}
                >
                  {label}
                </button>
              ))}
            </span>
            <button
              type="button"
              className="yom-admin-toggle"
              onClick={() => {
                const next = !showInternal;
                setShowInternal(next);
                load({ internal: next });
              }}
            >
              {showInternal
                ? "Hide internal"
                : `Real signups${totals.internal_hidden ? ` · ${totals.internal_hidden} hidden` : ""}`}
            </button>
          </nav>

          {err && <p className="yom-admin-err">{err}</p>}

          {tab === "overview" && (
            <>
              <div className="yom-admin-tiles">
                <article>
                  <b>{totals.people}</b>
                  <span>People (all time)</span>
                </article>
                <article>
                  <b>{totals.people_in_window}</b>
                  <span>Signed up · {rangeLabel}</span>
                </article>
                <article>
                  <b>{totals.opened_no_email}</b>
                  <span>Opened, no email · {rangeLabel}</span>
                </article>
                <article>
                  <b>{totals.with_lineup}</b>
                  <span>Built a lineup</span>
                </article>
                <article>
                  <b>{totals.public_lineups}</b>
                  <span>Shared a lineup</span>
                </article>
                <article>
                  <b>{totals.looks_total}</b>
                  <span>Looks scanned</span>
                </article>
              </div>

              <Section title={`Funnel · ${rangeLabel}`} show={(data.funnel || []).some((f) => f.people)}>
                <Funnel steps={data.funnel || []} />
              </Section>

              <div className="yom-admin-split">
                <Section title="Stuck" show={stuckTotal > 0}>
                  <ul className="yom-admin-stuck">
                    {data.stuck?.no_scan?.length ? (
                      <li>
                        <b>{data.stuck.no_scan.length}</b> gave an email, never scanned
                      </li>
                    ) : null}
                    {data.stuck?.scanned_no_lineup?.length ? (
                      <li>
                        <b>{data.stuck.scanned_no_lineup.length}</b> scanned, no lineup
                      </li>
                    ) : null}
                    {data.stuck?.lineup_not_shared?.length ? (
                      <li>
                        <b>{data.stuck.lineup_not_shared.length}</b> have a lineup, not shared
                      </li>
                    ) : null}
                  </ul>
                </Section>

                <Section title="Input method" show={hasInputs}>
                  <Chips
                    data={data.by_input}
                    extra={
                      data.avg_score != null ? (
                        <span key="avg">
                          Avg score <b>{data.avg_score}</b>
                        </span>
                      ) : null
                    }
                  />
                </Section>

                <Section title="Rounds" show={hasRounds}>
                  <Chips data={data.by_round} />
                </Section>

                <Section title="Campaign" show={hasCampaigns}>
                  <Chips data={data.by_campaign} />
                </Section>
              </div>

              {!totals.looks_total && (
                <p className="yom-admin-note">
                  Nobody has scanned a look yet, so there is nothing to break down by input method or round.
                </p>
              )}
            </>
          )}

          {tab === "people" && !(data.people || []).length && (
            <p className="yom-admin-empty">
              No one has given an email yet{showInternal ? "." : ", or everyone so far is internal."}
            </p>
          )}

          {tab === "people" && !!(data.people || []).length && (
            <div className="yom-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Campaign</th>
                    <th>First seen</th>
                    <th>Looks</th>
                    <th>Lineup</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.people || []).map((p) => (
                    <tr
                      key={p.email}
                      className={`is-clickable${open === p.email ? " is-open" : ""}`}
                      onClick={() => setOpen(open === p.email ? null : p.email)}
                    >
                      <td>{p.email}</td>
                      <td>{p.name || "—"}</td>
                      <td>{p.campaign || "—"}</td>
                      <td>{when(p.first_seen)}</td>
                      <td>{p.looks || 0}</td>
                      <td>{p.is_public ? "Public" : p.in_lineup ? `${p.in_lineup}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "activity" && !(data.activity || []).length && (
            <p className="yom-admin-empty">No scans yet. Every look anyone checks will appear here.</p>
          )}

          {tab === "activity" && !!(data.activity || []).length && (
            <div className="yom-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Scanned</th>
                    <th>Input</th>
                    <th>Round</th>
                    <th>Score</th>
                    <th>Kept</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.activity || []).map((a, i) => (
                    <tr key={`${a.at}-${i}`}>
                      <td>{ago(a.at)}</td>
                      <td>{a.email || "—"}</td>
                      <td>{[a.brand, a.title].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{a.input || "—"}</td>
                      <td>{a.round || "—"}</td>
                      <td>{a.score ?? "—"}</td>
                      <td>{a.in_lineup ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "issues" && (
            <>
              {data.error_log_missing && (
                <p className="yom-admin-err">
                  The error log table does not exist yet — run supabase/errors.sql and failures will appear here.
                </p>
              )}
              <Chips data={data.errors_by_kind} />
              {!data.error_log_missing && !(data.errors || []).length && (
                <p className="yom-admin-empty">
                  Nothing has failed since the log was switched on. Failed scans, API errors and page crashes
                  land here with the person who hit them.
                </p>
              )}
              {!!(data.errors || []).length && (
              <div className="yom-admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Kind</th>
                      <th>What broke</th>
                      <th>Status</th>
                      <th>Page</th>
                      <th>Who</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.errors || []).map((e, i) => (
                      <tr key={`${e.at}-${i}`}>
                        <td>{ago(e.at)}</td>
                        <td>{e.kind}</td>
                        <td className="is-wide">{e.message}</td>
                        <td>{e.status || "—"}</td>
                        <td>{e.path || "—"}</td>
                        <td>{e.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </>
      )}

      {person && (
        <aside className="yom-admin-drawer">
          <header>
            <div>
              <b>{person.name || person.email}</b>
              <span>{person.email}</span>
            </div>
            <button type="button" onClick={() => setOpen(null)} aria-label="close">
              ×
            </button>
          </header>
          <div className="yom-admin-campaigns">
            <span>
              First seen <b>{when(person.first_seen)}</b>
            </span>
            <span>
              Last seen <b>{ago(person.last_seen || person.first_seen)}</b>
            </span>
            <span>
              Checks <b>{person.checks || 0}</b>
            </span>
            <span>
              Devices <b>{person.anon_ids?.length || 0}</b>
            </span>
            <span>
              Lineup <b>{person.is_public ? "Public" : person.in_lineup || 0}</b>
            </span>
          </div>
          {person.scans?.length ? (
            <ol className="yom-admin-scans">
              {person.scans.map((s) => (
                <li key={s.id}>
                  <span className="yom-scan-when">{when(s.at)}</span>
                  <span className="yom-scan-what">
                    <b>{[s.brand, s.title].filter(Boolean).join(" · ") || "a look"}</b>
                    {s.verdict && <em>{s.verdict}</em>}
                  </span>
                  <span className="yom-scan-meta">
                    {[s.input, s.round, s.score != null ? `${s.score}/10` : "", s.in_lineup ? "in lineup" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pnm-sub">Gave an email, has not scanned anything.</p>
          )}
        </aside>
      )}
    </div>
  );
}
