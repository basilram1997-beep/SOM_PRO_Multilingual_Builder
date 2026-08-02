import { useEffect, useState } from "react";
import { KeyRound, LogIn, X } from "lucide-react";
import { useLogin } from "../../features/auth/useLogin";
import type { AuthUser } from "../../features/auth/authTypes";
import { LanguageSwitcher } from "../../i18n/i18n";

type LoginPageProps = {
  onLogin: (user: AuthUser) => void;
};

export { type AuthUser };

export function LoginPage({ onLogin }: LoginPageProps) {
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [systemOnline, setSystemOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const {
    email,
    setEmail,
    password,
    setPassword,
    remember,
    setRemember,
    message,
    loading,
    submit,
    labels,
    createRole,
    setCreateRole,
    createName,
    setCreateName,
    createUsername,
    setCreateUsername,
    createPassword,
    setCreatePassword,
    createMessage,
    createSaving,
    createLinkedAccount
  } = useLogin(onLogin);

  useEffect(() => {
    const handleOnline = () => setSystemOnline(true);
    const handleOffline = () => setSystemOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <main className="login-screen" data-e2e="login-screen">
      <div className="login-language-switcher">
        <LanguageSwitcher />
      </div>
      <div className="login-stack">
        <section className="login-hero-panel" aria-label={labels.heroAriaLabel}>
          <div className="login-hero-brand">
            <div className="login-hero-mark">SOM PRO</div>
            <div>
              <h2>{labels.heroWelcome}</h2>
            </div>
          </div>

          <div className="login-hero-status">
            <span>{labels.systemStatus}</span>
            <strong className={systemOnline ? "login-status-online" : "login-status-offline"}>
              {systemOnline ? labels.systemOnline : labels.systemOffline}
            </strong>
          </div>
        </section>

        <form className="login-card" onSubmit={submit} data-e2e="login-form" noValidate>
          <h1>{labels.title}</h1>
          <label htmlFor="login-username-input">
            <span>{labels.username}</span>
            <input
              id="login-username-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </label>
          <label htmlFor="login-password-input">
            <span>{labels.password}</span>
            <input
              id="login-password-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>{labels.remember}</span>
          </label>
          <button type="submit" disabled={loading}>
            <LogIn size={18} />
            <span>{loading ? labels.loading : labels.login}</span>
          </button>
          <button type="button" className="login-open-create-button" onClick={() => setCreateAccountOpen(true)}>
            <span>{labels.createCardTitle}</span>
          </button>
          {message ? (
            <p className="login-error" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      </div>

      {createAccountOpen ? (
        <div className="modal-backdrop login-create-backdrop" onClick={() => setCreateAccountOpen(false)}>
          <div
            className="modal-card login-create-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-create-account-title"
          >
            <div className="login-modal-header">
              <div>
                <div className="login-icon login-icon-secondary">
                  <KeyRound size={30} strokeWidth={2.2} />
                </div>
                <h2 id="login-create-account-title">{labels.createCardTitle}</h2>
                <p>{labels.createCardHelp}</p>
                <p className="login-note login-note-emphasis">{labels.createCardHint}</p>
              </div>
              <button
                type="button"
                className="login-modal-close"
                onClick={() => setCreateAccountOpen(false)}
                aria-label={labels.close}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="login-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createLinkedAccount();
              }}
              noValidate
            >
              <div className="login-fieldset">
                <span className="login-fieldset-label">{labels.createRole}</span>
                <div className="login-radio-group" role="radiogroup" aria-label={labels.createRole}>
                  <label className="login-radio-option">
                    <input
                      type="radio"
                      name="create-role"
                      checked={createRole === "STUDENT"}
                      onChange={() => setCreateRole("STUDENT")}
                    />
                    <span>{labels.createStudent}</span>
                  </label>
                  <label className="login-radio-option">
                    <input
                      type="radio"
                      name="create-role"
                      checked={createRole === "PARENT"}
                      onChange={() => setCreateRole("PARENT")}
                    />
                    <span>{labels.createParent}</span>
                  </label>
                  <label className="login-radio-option">
                    <input
                      type="radio"
                      name="create-role"
                      checked={createRole === "TEACHER"}
                      onChange={() => setCreateRole("TEACHER")}
                    />
                    <span>{labels.createTeacher}</span>
                  </label>
                  <label className="login-radio-option">
                    <input
                      type="radio"
                      name="create-role"
                      checked={createRole === "HOMEROOM_TEACHER"}
                      onChange={() => setCreateRole("HOMEROOM_TEACHER")}
                    />
                    <span>{labels.createHomeroomTeacher}</span>
                  </label>
                </div>
              </div>

              <label htmlFor="create-name-input">
                <span>{labels.createName}</span>
                <input
                  id="create-name-input"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label htmlFor="create-username-input">
                <span>{labels.createUsername}</span>
                <input
                  id="create-username-input"
                  value={createUsername}
                  onChange={(event) => setCreateUsername(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label htmlFor="create-password-input">
                <span>{labels.createPassword}</span>
                <input
                  id="create-password-input"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </label>

              <button type="submit" disabled={createSaving}>
                <span>{createSaving ? labels.createCreating : labels.createAccount}</span>
              </button>
            </form>

            {createMessage ? (
              <p className="login-error" role="alert">
                {createMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
