export async function SignupUser({ name, email, password, phone }) {
    const response = await fetch("http://backend-url/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
        phone,
        date: new Date().toLocaleString(),
      }),
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Signup failed");
    }
    return await response.json();
  }
  