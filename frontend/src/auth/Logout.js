export async function LogoutUser() {
    try {
      const response = await fetch("http://backend-url/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 필요한 경우 쿠키 등을 포함하려면 credentials: "include" 옵션 추가
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Logout error:", errorData);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  