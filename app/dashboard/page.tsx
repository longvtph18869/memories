import { cookies } from "next/headers"
import DashboardClient from "./client"

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const isAdmin = cookieStore.get("admin_session")?.value === "true"

    return <DashboardClient isAuthenticated={isAdmin} />
}
