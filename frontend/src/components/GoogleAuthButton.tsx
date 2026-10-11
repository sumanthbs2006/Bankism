import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';
import { AuthUser } from '../types';
import { api } from '../api';
import { Sparkles } from 'lucide-react';

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
          prompt: () => void;
        };
      };
    };
  }
}

// Decode base64url JWT payload
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
  const [gisLoaded, setGisLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultButtonText =
    buttonText || (mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google');

  const handleCredentialResponse = async (response: any) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = parseJwtPayload(response.credential);
      if (!payload || !payload.email) {
        throw new Error('Could not extract user details from Google credential.');
      }

      const authUser: AuthUser = {
        id: payload.sub || `google_${Date.now()}`,
        name: payload.name || payload.given_name || 'Google User',
        email: payload.email,
        picture: payload.picture,
        provider: 'google',
        signedInAt: new Date().toISOString()
      };

      // Record to backend DB
      try {
        await api.loginGoogle({
          credential: response.credential,
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
      setErrorMessage(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let initialized = false;
    const renderGis = () => {
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

          // Render the official Google Identity Services button
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
          console.warn('GIS render button notice:', e);
        }
      }
    };

    renderGis();
    const timer = setInterval(() => {
      if (!initialized && window.google?.accounts?.id) {
        renderGis();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [mode, darkVariant]);

  const handleDemoGoogleSignIn = async () => {
    setLoading(true);
    const demoUser: AuthUser = {
      id: 'demo_google_auditor_991',
      name: 'Security Lead Auditor',
      email: 'auditor.security@bankism.ai',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
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
      console.warn(e);
    }

    onSuccess(demoUser);
    setLoading(false);
  };

  return (
    <div className={`space-y-3 flex flex-col items-center w-full ${className}`}>
      {/* Official Google Identity Services Render Target */}
      <div className="flex flex-col items-center justify-center min-h-[44px] w-full">
        <div ref={buttonContainerRef} className="rounded-full overflow-hidden shadow-md" />
      </div>

      {/* Fallback & Custom Branded Button if GIS is delayed or blocked */}
      {!gisLoaded && (
        <button
          onClick={() => {
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            } else {
              handleDemoGoogleSignIn();
            }
          }}
          disabled={loading}
          className={`apple-pressable inline-flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all w-full max-w-[280px] ${
            darkVariant
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20 backdrop-blur-md'
              : 'bg-[#ffffff] hover:bg-[#f6efe4] text-[#0f172a] border border-[#cbd5e1]/25 shadow-apple-button'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <span>{loading ? 'Authenticating...' : defaultButtonText}</span>
        </button>
      )}

      {/* Alternative Demo Sign-In Link */}
      {showDemoOption && (
        <div
          className={`flex items-center gap-2 pt-0.5 text-[11px] ${
            darkVariant ? 'text-white/60' : 'text-[#64748b]'
          }`}
        >
          <span>Or test instantly:</span>
          <button
            onClick={handleDemoGoogleSignIn}
            className={`font-semibold underline underline-offset-2 transition-colors inline-flex items-center gap-1 ${
              darkVariant
                ? 'text-[#f2a87a] hover:text-[#ffd1b3]'
                : 'text-[#9e4c27] hover:text-[#b45e35]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#f2a87a]" />
            1-Click Demo Auditor Sign-In
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="text-xs text-[#c53b3b] font-mono bg-[#faecea] px-3 py-1.5 rounded-xl border border-[#f0c3bf]">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
