// src/hooks/UseGoogleAuth.js
// Google Auth 기능 제거됨 - 더미 인증으로 전환
import { useState } from "react";

function useGoogleAuth() {
  // 더미 상태값들 - Google API 의존성 제거
  const [gapiLoaded] = useState(true); // 항상 로딩 완료 상태
  const [isSignedIn] = useState(false); // 기본적으로 로그인되지 않은 상태
  const [tokenClient] = useState(null);

  // 더미 함수들 - 실제 기능 없음
  const signIn = () => {
    console.log("Dummy signIn - 더미 인증 시스템 사용중");
  };

  const silentSignIn = () => {
    console.log("Dummy silentSignIn - 더미 인증 시스템 사용중");
  };

  const signOut = () => {
    console.log("Dummy signOut - 더미 인증 시스템 사용중");
  };

  return { gapiLoaded, isSignedIn, signIn, silentSignIn, signOut };
}

export default useGoogleAuth;
