import { useState, useEffect, useCallback } from 'react';

const useGoogleAuth = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true); // 즉시 true로 설정
  const [gapiLoaded, setGapiLoaded] = useState(true); // 즉시 true로 설정
  const [user, setUser] = useState(null);

  // Google API 초기화 (선택적, 실패해도 계속 진행)
  const initializeGoogleAPI = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.gapi) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('Google API 로드 타임아웃 - 계속 진행');
            resolve();
          }, 3000); // 3초 타임아웃
          
          window.gapi.load('auth2', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        const authInstance = window.gapi.auth2.getAuthInstance();
        if (authInstance) {
          const isSignedInStatus = authInstance.isSignedIn.get();
          setIsSignedIn(isSignedInStatus);
          
          if (isSignedInStatus) {
            const currentUser = authInstance.currentUser.get();
            const profile = currentUser.getBasicProfile();
            setUser({
              id: profile.getId(),
              name: profile.getName(),
              email: profile.getEmail(),
              imageUrl: profile.getImageUrl()
            });
          }
        }
      }
    } catch (error) {
      console.error('Google API 초기화 오류 (무시됨):', error);
    } finally {
      setIsInitialized(true);
      setGapiLoaded(true);
    }
  }, []);

  // 로그인
  const signIn = useCallback(async () => {
    try {
      if (window.gapi && window.gapi.auth2) {
        const authInstance = window.gapi.auth2.getAuthInstance();
        const googleUser = await authInstance.signIn();
        const profile = googleUser.getBasicProfile();
        
        setUser({
          id: profile.getId(),
          name: profile.getName(),
          email: profile.getEmail(),
          imageUrl: profile.getImageUrl()
        });
        setIsSignedIn(true);
        
        return googleUser;
      } else {
        throw new Error('Google API를 사용할 수 없습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      throw error;
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      if (window.gapi && window.gapi.auth2) {
        const authInstance = window.gapi.auth2.getAuthInstance();
        await authInstance.signOut();
        setUser(null);
        setIsSignedIn(false);
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  }, []);

  useEffect(() => {
    // 즉시 초기화 완료로 설정
    setIsInitialized(true);
    setGapiLoaded(true);
    
    // Google API 초기화를 시도하지만 실패해도 계속 진행
    initializeGoogleAPI();
  }, [initializeGoogleAPI]);

  return {
    isSignedIn,
    isInitialized,
    gapiLoaded, // App.jsx에서 사용하는 속성
    user,
    signIn,
    signOut
  };
};

export default useGoogleAuth; 