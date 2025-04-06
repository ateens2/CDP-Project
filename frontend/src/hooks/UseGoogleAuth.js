// src/hooks/useGoogleAuth.js
import { useEffect, useState } from "react";

// TODO: 아래 값을 실제 Google Cloud Console에서 발급받은 값으로 변경하세요.
const CLIENT_ID = "267145768352-q28nigb1hsn9ckr0nk5b663gi5jj7k9d.apps.googleusercontent.com";
const API_KEY = "AIzaSyDtIXdcTi7-WHAbZerQUWhUl6KH1Xizllk";
const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

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
        // Google Identity Services 스크립트 로드
        await loadScript("https://accounts.google.com/gsi/client");
        
        // gapi 스크립트 로드
        await loadScript("https://apis.google.com/js/api.js");
        
        // gapi 클라이언트 초기화
        await new Promise((resolve) => {
          window.gapi.load("client", resolve);
        });
        
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        
        setGapiLoaded(true);

        // Google Identity Services 토큰 클라이언트 초기화
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
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

  const signOut = async () => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken("");
      setIsSignedIn(false);
    }
  };

  return { gapiLoaded, isSignedIn, signIn, signOut };
}

export default useGoogleAuth;
