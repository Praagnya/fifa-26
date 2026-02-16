import { useState } from "react";
import { useAuth } from "../context/AuthContext";

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [view, setView] = useState<"form" | "confirmation" | "resetSent">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showGoogleHint, setShowGoogleHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowGoogleHint(false);
    setLoading(true);

    if (tab === "signup" && password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match");
      return;
    }

    if (tab === "signin") {
      const result = await signInWithEmail(email, password);
      setLoading(false);
      if (result.error) {
        if (result.error === "Invalid login credentials") {
          setShowGoogleHint(true);
        }
        setError(result.error);
      } else {
        onClose();
      }
    } else {
      const result = await signUpWithEmail(email, password);
      setLoading(false);
      if (result.error) {
        if (result.error.toLowerCase().includes("already registered")) {
          setShowGoogleHint(true);
        }
        setError(result.error);
      } else if (result.needsConfirmation) {
        setView("confirmation");
      } else {
        onClose();
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setView("resetSent");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-full max-w-sm mx-4 bg-[#16161e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide">
                Sign in to chat
              </p>
              <p className="text-[10px] text-white/30">
                Access the FIFA 2026 Assistant
              </p>
            </div>
          </div>
        </div>

        {view === "confirmation" ? (
          /* ── Email confirmation sent ── */
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide mb-2">
              Check your email
            </p>
            <p className="text-xs text-white/40 mb-5">
              We sent a confirmation link to <span className="text-white/70">{email}</span>. Click it to activate your account, then come back and sign in.
            </p>
            <button
              onClick={() => { setView("form"); setTab("signin"); setError(null); }}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : view === "resetSent" ? (
          /* ── Password reset email sent ── */
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide mb-2">
              Reset link sent
            </p>
            <p className="text-xs text-white/40 mb-5">
              We sent a password reset link to <span className="text-white/70">{email}</span>. Check your inbox and follow the link to set a new password.
            </p>
            <button
              onClick={() => { setView("form"); setShowForgot(false); setTab("signin"); setError(null); }}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : showForgot ? (
          /* ── Forgot password form ── */
          <>
            <div className="px-6 pt-2 pb-1">
              <p className="text-xs font-bold text-white/60 font-['Oswald'] uppercase tracking-wider">
                Reset Password
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="px-6 py-5 space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider font-['Oswald'] block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-bold text-white font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
              >
                {loading ? "Please wait..." : "Send Reset Link"}
              </button>
            </form>

            <div className="px-6 pb-5">
              <button
                onClick={() => { setShowForgot(false); setError(null); }}
                className="w-full text-center text-xs text-white/30 hover:text-white/50 font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </>
        ) : (
          <>
            {/* tabs */}
            <div className="flex px-6 gap-1">
              <button
                onClick={() => { setTab("signin"); setError(null); setConfirmPassword(""); }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider font-['Oswald'] rounded-t-lg transition-colors cursor-pointer ${
                  tab === "signin"
                    ? "text-white bg-white/5 border-b-2 border-indigo-500"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab("signup"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider font-['Oswald'] rounded-t-lg transition-colors cursor-pointer ${
                  tab === "signup"
                    ? "text-white bg-white/5 border-b-2 border-indigo-500"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider font-['Oswald'] block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider font-['Oswald'] block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {tab === "signup" && (
                <div>
                  <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider font-['Oswald'] block mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                  {showGoogleHint && (
                    <p className="text-xs text-white/40 mt-1">
                      Did you sign up with Google? Try using <button type="button" onClick={signInWithGoogle} className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer">Continue with Google</button> below instead.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-bold text-white font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
              >
                {loading
                  ? "Please wait..."
                  : tab === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>

              {tab === "signin" && (
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setError(null); }}
                  className="w-full text-center text-[11px] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </form>

            {/* divider */}
            <div className="px-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/20 uppercase tracking-wider font-['Oswald']">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* google button */}
            <div className="px-6 py-5">
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-xs font-semibold text-white/70 font-['Oswald'] uppercase tracking-wider">
                  Continue with Google
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
