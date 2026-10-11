import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';
import { AuthUser } from '../types';
import { api } from '../api';

interface GoogleAuthButtonProps {
  onSuccess: (user: AuthUser) => void;
  className?: string;
  buttonText?: string;
  mode?: 'signin' | 'signup';
  darkVariant?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (listener?: any) => void;
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

// Decode base64url JWT payload from Google ID Token
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
  darkVariant = true
}) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultButtonText =
    buttonText || (mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google');

  // Handle successful Google user authentication (stores to backend & updates app state)
  const handleAuthenticatedUser = useCallback(
    async (profile: { id: string; name: string; email: string; picture?: string; credential?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const authUser: AuthUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
          provider: 'google',
          signedInAt: new Date().toISOString()
        };

        // Record real Google account in backend database
        try {
          await api.loginGoogle({
            credential: profile.credential,
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
      } catch (err: any) {
        console.error('Google auth processing error:', err);
        setError(err.message || 'Failed to authenticate Google user.');
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  // Callback when user signs in through official Google Identity Services button
  const handleCredentialResponse = useCallback(
    async (response: any) => {
      try {
        const payload = parseJwtPayload(response.credential);
        if (!payload || !payload.email) {
          throw new Error('Could not read user details from Google credential.');
        }

        await handleAuthenticatedUser({
          id: payload.sub || `google_${Date.now()}`,
          name: payload.name || payload.given_name || payload.email.split('@')[0],
          email: payload.email,
          picture: payload.picture,
          credential: response.credential
        });
      } catch (err: any) {
        setError(err.message || 'Google authentication failed.');
        setLoading(false);
      }
    },
    [handleAuthenticatedUser]
  );

  // Initialize and render official Google Identity Services button
  useEffect(() => {
    let initialized = false;

    const initGis = () => {
      if (initialized) return;
      if (window.google?.accounts?.id && buttonContainerRef.current) {
        try {
          buttonContainerRef.current.innerHTML = '';

          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            context: mode === 'signin' ? 'signin' : 'signup'
          });

          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            type: 'standard',
            theme: darkVariant ? 'filled_black' : 'outline',
            size: 'large',
            text: mode === 'signin' ? 'signin_with' : 'signup_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: 280
          });

          setGisLoaded(true);
          initialized = true;
        } catch (e) {
          console.warn('GIS render notice:', e);
        }
      }
    };

    initGis();
    const interval = setInterval(() => {
      if (!initialized && window.google?.accounts?.id) {
        initGis();
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [mode, darkVariant, handleCredentialResponse]);

  // Click handler for custom button (triggers Google OAuth2 popup for account selection)
  const handleCustomClick = () => {
    setLoading(true);
    setError(null);

    // 1. If Google OAuth2 token client is available, request real access token
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setLoading(false);
              setError(tokenResponse.error_description || `Google sign-in was not completed.`);
              return;
            }

            if (tokenResponse.access_token) {
              try {
                // Fetch user profile directly from Google
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const profile = await res.json();
                await handleAuthenticatedUser({
                  id: profile.sub || `google_${Date.now()}`,
                  name: profile.name || profile.given_name || profile.email.split('@')[0],
                  email: profile.email,
                  picture: profile.picture,
                  credential: tokenResponse.access_token
                });
              } catch (e: any) {
                setError('Failed to fetch user profile from Google.');
                setLoading(false);
              }
            } else {
              setLoading(false);
            }
          },
          error_callback: (err: any) => {
            console.warn('OAuth popup error:', err);
            setLoading(false);
            setError(err?.message || 'Google account sign-in popup was cancelled or blocked.');
          }
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Error launching tokenClient:', err);
      }
    }

    // 2. If GIS One Tap is available, prompt for Google account
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      setTimeout(() => setLoading(false), 2000);
      return;
    }

    setLoading(false);
    setError('Google authentication service is loading. Please try again in a moment.');
  };

  return (
    <div className={`flex flex-col items-center w-full space-y-2 ${className}`}>
      {/* Official Google Identity Services Render Target (Native Google button with real account picker) */}
      <div
        ref={buttonContainerRef}
        className="min-h-[44px] flex items-center justify-center rounded-full overflow-hidden shadow-md"
      />

      {/* Branded Fallback Button (rendered if GIS script is still loading or iframe suppressed) */}
      {!gisLoaded && (
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={loading}
          className={`apple-pressable inline-flex items-center justify-center gap-3 px-6 py-2.5 rounded-full font-semibold text-xs transition-all w-full max-w-[280px] shadow-md ${
            darkVariant
              ? 'bg-[#131314] hover:bg-[#202124] text-white border border-white/20 active:scale-[0.98]'
              : 'bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] active:scale-[0.98]'
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
      )}

      {error && (
        <p className="text-[11px] text-red-300 font-mono text-center max-w-[280px]">
          {error}
        </p>
      )}
    </div>
  );
};
