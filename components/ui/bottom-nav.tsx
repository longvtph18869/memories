"use client"

import { Info, Grid } from "lucide-react"

interface BottomNavProps {
    onInfoClick: () => void
    onGridClick: () => void
    isGridView: boolean
}

export function BottomNav({ onInfoClick, onGridClick, isGridView }: BottomNavProps) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-40">
            <button
                onClick={onInfoClick}
                className="group p-2 bg-background/80 backdrop-blur-sm border border-border hover:bg-border/50 transition-colors"
            >
                <Info className="w-3 h-3 text-foreground-muted group-hover:text-foreground-bright transition-colors" />
            </button>

            <div className="w-px h-8 bg-border/50" />

            <button
                onClick={onGridClick}
                className="group p-2 bg-background/80 backdrop-blur-sm border border-border hover:bg-border/50 transition-colors"
                title={isGridView ? "Chuyển sang Góc nhìn 3D" : "Chuyển sang Dạng lưới"}
            >
                <Grid className={`w-3 h-3 transition-colors ${isGridView ? "text-foreground-bright" : "text-foreground-muted group-hover:text-foreground-bright"}`} />
            </button>
        </div>
    )
}
