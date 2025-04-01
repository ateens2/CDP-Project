// src/api/UploadSheet.js
export async function UploadSheet(file, userEmail) {
  const formData = new FormData();
  formData.append("file", file);
  // 로그인한 사용자의 이메일을 함께 전송
  formData.append("email", userEmail);

  const response = await fetch("http://backend-url/api/upload", {
    method: "POST",
    body: formData,
    // 필요 시 credentials: "include" 옵션 추가
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "File upload failed");
  }
  return await response.json();
}
