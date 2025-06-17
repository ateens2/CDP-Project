export function loginWithGoogle(backendUrl) {
  // 더미 인증 플로우를 시작하기 위해 백엔드로 리디렉션 (Google OAuth 제거됨)
  window.location.href = `${backendUrl}/auth/google`;
}