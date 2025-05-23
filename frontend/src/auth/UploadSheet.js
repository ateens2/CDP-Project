// src/auth/UploadSheet.js
export async function uploadSheet(file, userEmail, backendUrl) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("email", userEmail);

  const response = await fetch(`${backendUrl}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "File upload failed");
  }
  return await response.json();
}
