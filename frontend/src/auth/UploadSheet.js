export async function UploadSheet(file) {
    const formData = new FormData();
    formData.append("file", file);
  
    const response = await fetch("http://backend-url/api/upload", {
      method: "POST",
      body: formData,
      // 필요한 경우 credentials: "include" 옵션 추가
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "File upload failed");
    }
    return await response.json();
  }
  