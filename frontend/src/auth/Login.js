export function loginWithGoogle(backendUrl) {
  // Passport 인증 플로우를 시작하기 위해 백엔드로 리디렉션
  window.location.href = `${backendUrl}/auth/google`;
}