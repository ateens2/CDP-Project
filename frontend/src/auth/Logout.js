// src/auth/Logout.js
export async function logoutUser(backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: "GET",
      credentials: "include", // 쿠키를 전송
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Logout failed");
    }
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}
