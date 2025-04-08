// src/auth/Signup.js
export async function signupUser({ name, email, phone }, backendUrl) {
  const response = await fetch(`${backendUrl}/auth/google/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, phone }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Signup failed");
  }
  return await response.json();
}
