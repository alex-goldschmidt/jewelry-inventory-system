import { useState } from "react";
import type { FormEvent } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "./api/errorMessage";
import { resolveQueryErrorState } from "./api/queryState";
import { setAccessToken } from "./auth/token";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { useSignIn } from "./hooks/useSignIn";
import { useRegister } from "./hooks/useRegister";
import { useRefresh } from "./hooks/useRefresh";
import { useLogout } from "./hooks/useLogout";

export function App() {
  const queryClient = useQueryClient();
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeAction, setActiveAction] = useState<"signIn" | "register" | "refresh" | "logout">("signIn");

  async function updateSession(token: string | undefined) {
    await queryClient.cancelQueries();
    queryClient.clear();
    setAccessToken(token);
    setHasSession(Boolean(token));
    setPassword("");
    setNotice("");
  }

  const currentUser = useCurrentUser(hasSession);
  const signIn = useSignIn((response) => updateSession(response.accessToken));
  const register = useRegister(() => {
    setRegistering(false);
    setPassword("");
    setNotice("Account created. Sign in to continue.");
  });
  const refresh = useRefresh((response) => updateSession(response?.accessToken));
  const logout = useLogout(() => updateSession(undefined));

  const busy = useIsMutating() > 0;
  const actions = { signIn, register, refresh, logout };
  const { isError, error } = resolveQueryErrorState(actions[activeAction], currentUser);

  function refreshSession() {
    setActiveAction("refresh");
    refresh.refresh();
  }

  function signOut() {
    setActiveAction("logout");
    logout.logout();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const input = { email, password };
    if (registering) {
      setActiveAction("register");
      register.register(input);
    } else {
      setActiveAction("signIn");
      signIn.signIn(input);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <a className="brand" href="/">Express <span>+ React</span></a>
        <a className="docs-link" href="/api/docs" target="_blank" rel="noreferrer">API reference ↗</a>
      </header>
      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">YOUR NEXT PROJECT STARTS HERE</p>
          <h1>A small foundation.<br />Room to build.</h1>
          <p className="lede">An Express API and a React frontend, connected by a shared contract. Start with an account, then make it yours.</p>
          <div className="stack"><span>TypeScript</span><span>React</span><span>TanStack Query</span></div>
        </div>
        <section className="card" aria-labelledby="account-title">
          {hasSession ? (
            <>
              <p className="eyebrow">YOUR ACCOUNT</p>
              <h2 id="account-title">You’re signed in.</h2>
              {!currentUser.user && !currentUser.isError && <p role="status">Loading your profile…</p>}
              {currentUser.user && <dl className="profile">
                <dt>Email</dt><dd>{currentUser.user.email}</dd>
                <dt>User ID</dt><dd>{currentUser.user.userId}</dd>
              </dl>}
              <div className="actions">
                <button disabled={busy} onClick={refreshSession}>Refresh session</button>
                <button className="secondary" disabled={busy} onClick={signOut}>Sign out</button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">MAKE YOURSELF AT HOME</p>
              <h2 id="account-title">{registering ? "Create your account." : "Welcome back."}</h2>
              <p className="card-description">{registering ? "A new account, ready for what’s next." : "Sign in to pick up where you left off."}</p>
              <form onSubmit={submit}>
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} />
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={8} maxLength={255} value={password} onChange={(event) => setPassword(event.target.value)} />
                <button disabled={busy} type="submit">{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}<span aria-hidden="true"> →</span></button>
              </form>
              <div className="account-options">
                <button className="text-button" disabled={busy} onClick={() => { setRegistering(!registering); setActiveAction(registering ? "signIn" : "register"); setNotice(""); }}>
                  {registering ? "Already have an account? Sign in" : "New here? Create an account"}
                </button>
                <button className="text-button" disabled={busy} onClick={refreshSession}>Restore an existing session</button>
              </div>
            </>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
          {isError && <p className="error" role="alert">{errorMessage(error)}</p>}
        </section>
      </section>
      <footer>Built to grow with your ideas.</footer>
    </main>
  );
}
