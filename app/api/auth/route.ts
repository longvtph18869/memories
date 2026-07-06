import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        
        // Dùng mật khẩu từ biến môi trường, hoặc mặc định là "admin123" nếu chưa cấu hình
        const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

        if (password === adminPassword) {
            const response = NextResponse.json({ success: true });
            
            // Set cookie để xác thực admin
            response.cookies.set({
                name: "admin_session",
                value: "true",
                httpOnly: true,
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 7, // 1 tuần
            });

            return response;
        }

        return NextResponse.json({ success: false, error: "Sai mật khẩu" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Yêu cầu không hợp lệ" }, { status: 400 });
    }
}
