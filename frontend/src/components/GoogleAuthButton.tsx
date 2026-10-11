import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';
import { AuthUser } from '../types';
import { api } from '../api';
import { Sparkles, AlertTriangle, Check, Copy } from 'lucide-react';

interface GoogleAuthButtonProps {
  onSuccess: (user: AuthUser) => void;
  className?: string;
  buttonText?: string;
  mode?: 'signin' | 'signup';
  showDemoOption?: boolean;
  darkVariant?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (momentListener?: any) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Helper to decode base64url JWT payload from Google ID Token
function parseJwtPayload(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse Google JWT payload:', e);
    return null;
  }
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  className = '',
  buttonText,
  mode = 'signup',
  showDemoOption = true,
  darkVariant = false
}) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [originError, setOriginError] = useState<boolean>(false);
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const defaultButtonText =
    buttonText || (mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google');

  // Handle successful Google authentication payload (either ID token or UserInfo profile)
  const completeAuth = useCallback(
    async (profile: { id: string; name: string; email: string; picture?: string; token?: string }) => {
      setLoading(true);
      setErrorMessage(null);
      setOriginError(false);

      const authUser: AuthUser = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
        provider: 'google',
        signedInAt: new Date().toISOString()
      };

      // Sync user record to backend SQLite database
      try {
        await api.loginGoogle({
          credential: profile.token,
          email: authUser.email,
          name: authUser.name,
          picture: authUser.picture,
          sub: authUser.id,
          provider: 'google'
        });
      } catch (err) {
        console.warn('Backend user record sync notice:', err);
      }

      onSuccess(authUser);
      setLoading(false);
    },
    [onSuccess]
  );

  // Handle Credential Response from Google One Tap / renderButton
  const handleCredentialResponse = useCallback(
    async (response: any) => {
      try {
        const payload = parseJwtPayload(response.credential);
        if (!payload || !payload.email) {
          throw new Error('Could not extract user details from Google credential.');
        }

        await completeAuth({
          id: payload.sub || `google_${Date.now()}`,
          name: payload.name || payload.given_name || 'Google User',
          email: payload.email,
          picture: payload.picture,
          token: response.credential
        });
      } catch (err: any) {
        console.error('Google auth processing error:', err);
        setErrorMessage(err.message || 'Google authentication failed.');
        setLoading(false);
      }
    },
    [completeAuth]
  );

  // Initialize Google Identity Services (both One Tap / renderButton and oauth2)
  useEffect(() => {
    let mounted = true;

    const setupGis = () => {
      if (!window.google?.accounts) return;

      try {
        // 1. Initialize Google ID (One Tap)
        if (window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            context: mode === 'signin' ? 'signin' : 'signup'
          });

          // Render official button if container exists
          if (buttonContainerRef.current) {
            buttonContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainerRef.current, {
              type: 'standard',
              theme: darkVariant ? 'filled_black' : 'outline',
              size: 'large',
              text: mode === 'signin' ? 'signin_with' : 'signup_with',
              shape: 'pill',
              logo_alignment: 'left',
              width: 280
            });
          }
        }
      } catch (e: any) {
        console.warn('Google Identity Services init notice:', e);
      }
    };

    setupGis();
    const interval = setInterval(() => {
      if (window.google?.accounts) {
        setupGis();
        clearInterval(interval);
      }
    }, 400);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [mode, darkVariant, handleCredentialResponse]);

  // Handle click on the custom Apple-designed Google Button using Google OAuth2 Token Client
  const handleCustomGoogleClick = () => {
    setLoading(true);
    setErrorMessage(null);
    setOriginError(false);

    // If Google SDK is loaded and has oauth2 token client
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('OAuth token callback error:', tokenResponse);
              if (
                tokenResponse.error === 'origin_mismatch' ||
                tokenResponse.error === 'idpiframe_initialization_failed'
              ) {
                setOriginError(true);
              }
              setErrorMessage(
                tokenResponse.error_description ||
                  `Google Sign-In notice: ${tokenResponse.error}`
              );
              setLoading(false);
              return;
            }

            if (tokenResponse.access_token) {
              try {
                // Fetch user info with access token
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`
                  }
                });
                const profile = await userInfoRes.json();
                await completeAuth({
                  id: profile.sub || `google_${Date.now()}`,
                  name: profile.name || profile.given_name || 'Google User',
                  email: profile.email,
                  picture: profile.picture,
                  token: tokenResponse.access_token
                });
              } catch (e: any) {
                console.error('Failed to fetch Google profile:', e);
                setErrorMessage('Unable to load Google user profile.');
                setLoading(false);
              }
            } else {
              setLoading(false);
            }
          },
          error_callback: (err: any) => {
            console.warn('Google OAuth popup error callback:', err);
            setLoading(false);
            if (
              err?.type === 'origin_mismatch' ||
              err?.message?.toLowerCase().includes('origin')
            ) {
              setOriginError(true);
              setErrorMessage(
                `Origin mismatch: "${currentOrigin}" is not registered in Google Cloud Console.`
              );
            } else {
              setErrorMessage(
                err?.message || 'Google popup was closed or encountered a configuration error.'
              );
            }
          }
        });

        // Open Google popup
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('Error launching tokenClient:', err);
      }
    }

    // Fallback: try prompt from google.accounts.id
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setLoading(false);
            setOriginError(true);
            setErrorMessage(
              `Google One Tap is not allowed on "${currentOrigin}". Please add this domain to Google Cloud Console or continue below.`
            );
          }
        });
        setTimeout(() => setLoading(false), 2000);
        return;
      } catch (err) {
        console.warn('Prompt error:', err);
      }
    }

    // If Google SDK is not reachable (adblocker or offline)
    setLoading(false);
    setErrorMessage(
      'Google services are unavailable or blocked by browser settings. You can use 1-Click Demo Login below.'
    );
  };

  // Instant 1-Click Demo Auditor Sign-In
  const handleDemoGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    const demoUser: AuthUser = {
      id: 'demo_google_auditor_991',
      name: 'Security Lead Auditor',
      email: 'auditor.security@bankism.ai',
      picture:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      provider: 'demo',
      signedInAt: new Date().toISOString()
    };

    try {
      await api.loginGoogle({
        email: demoUser.email,
        name: demoUser.name,
        picture: demoUser.picture,
        sub: demoUser.id,
        provider: 'demo'
      });
    } catch (e) {
      console.warn('Backend sync notice in demo login:', e);
    }

    onSuccess(demoUser);
    setLoading(false);
  };

  const copyOriginToClipboard = () => {
    if (currentOrigin) {
      navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2500);
    }
  };

  return (
    <div className={`space-y-3 flex flex-col items-center w-full ${className}`}>
      {/* Official Google Identity Services Render Target (if browser allows it) */}
      <div
        ref={buttonContainerRef}
        className="empty:hidden min-h-[44px] flex items-center justify-center rounded-full overflow-hidden shadow-md"
      />

      {/* Primary Apple-Branded Google Auth Button (Opens Google popup directly) */}
      <button
        type="button"
        onClick={handleCustomGoogleClick}
        disabled={loading}
        className={`apple-pressable inline-flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all w-full max-w-[280px] shadow-sm ${
          darkVariant
            ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20 backdrop-blur-md active:bg-white/20'
            : 'bg-[#ffffff] hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] shadow-apple-button'
        }`}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{loading ? 'Opening Google...' : defaultButtonText}</span>
      </button>

      {/* Prominent Instant 1-Click Demo Login */}
      {showDemoOption && (
        <div className="flex flex-col items-center gap-1 pt-1 w-full max-w-[280px]">
          <button
            type="button"
            onClick={handleDemoGoogleSignIn}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
              darkVariant
                ? 'bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 text-[#fcd34d] border-[#f59e0b]/30'
                : 'bg-[#fffbeb] hover:bg-[#fef3c7] text-[#b45309] border-[#fde68a]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span>1-Click Demo Auditor Sign-In</span>
          </button>
          <span
            className={`text-[10px] ${
              darkVariant ? 'text-white/50' : 'text-[#64748b]'
            }`}
          >
            Instant bypass for evaluations & testing
          </span>
        </div>
      )}

      {/* Origin Mismatch / Setup Helper Banner */}
      {originError && (
        <div className="w-full max-w-[340px] p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">Google Origin Setup Required</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Google Cloud blocks OAuth until you add this domain to{' '}
                <strong>Authorized JavaScript origins</strong> in Google Cloud Console:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/40 border border-white/10 font-mono text-[10px] text-white">
            <span className="truncate flex-1">{currentOrigin}</span>
            <button
              type="button"
              onClick={copyOriginToClipboard}
              className="p-1 hover:bg-white/10 rounded text-amber-300 flex items-center gap-1"
              title="Copy origin to clipboard"
            >
              {copiedOrigin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="text-[9px]">{copiedOrigin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDemoGoogleSignIn}
            className="w-full py-1.5 rounded bg-amber-400 text-black font-semibold text-[11px] hover:bg-amber-300 transition-colors"
          >
            Continue with Demo Account Now →
          </button>
        </div>
      )}

      {/* Generic Error Notice */}
      {errorMessage && !originError && (
        <div className="text-xs text-red-300 font-mono bg-red-950/40 px-3 py-2 rounded-xl border border-red-500/30 max-w-[280px] text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
