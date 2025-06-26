export async function uploadFileToS3(bucket: string, folderPath: string, file: File): Promise<string | null> {
    const url = `https://api.glob-dev.kong.yk8s.me/api/media/v1/s3-files/buckets/${bucket}/folder_paths/${folderPath}`;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`파일 업로드 실패: ${response.statusText}`);
        }

        const data = await response.json();
        return data.uploadedUrl || null;
    } catch (error) {
        console.error("파일 업로드 중 오류 발생:", error);
        return null;
    }
}
