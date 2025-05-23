// src/hooks/UseGoogleAuth.js
import { useEffect, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];
const SCOPES = "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

function useGoogleAuth() {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    const initializeGoogleAuth = async () => {
      try {
        // Load Google Identity Services and gapi
        await loadScript("https://accounts.google.com/gsi/client");
        await loadScript("https://apis.google.com/js/api.js");
        await new Promise((resolve) => {
          window.gapi.load("client", resolve);
        });
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        setGapiLoaded(true);

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          // 일반 signIn 호출 시 팝업이 뜨게 됩니다.
          callback: (response) => {
            console.log("OAuth response:", response);
            if (response.access_token) {
              setIsSignedIn(true);
              window.gapi.client.setToken({ access_token: response.access_token });
            }
          },
        });
        setTokenClient(client);
      } catch (error) {
        console.error("Error initializing Google Auth:", error);
      }
    };

    initializeGoogleAuth();
  }, []);

  // 기존 signIn: 기본적으로 팝업을 띄웁니다.
  const signIn = () => {
    if (!tokenClient) {
      console.error("Token client not initialized");
      return;
    }
    try {
      tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  // silentSignIn: prompt 없이 토큰 요청 (팝업 없이 시도)
  const silentSignIn = () => {
    if (!tokenClient) {
      console.error("Token client not initialized");
      return;
    }
    try {
      tokenClient.requestAccessToken({ prompt: "none" });
    } catch (error) {
      console.error("Error in silent sign in:", error);
    }
  };

  const signOut = async () => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken("");
      setIsSignedIn(false);
    }
  };

  return { gapiLoaded, isSignedIn, signIn, silentSignIn, signOut };
}

export default useGoogleAuth;
