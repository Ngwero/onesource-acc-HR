"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

interface TopbarProps {
  userName: string;
  userRole: UserRole;
  notificationCount?: number;
}

export function Topbar({ userName, userRole, notificationCount = 0 }: TopbarProps) {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-green-100 bg-white px-6">
      <form onSubmit={handleSearch} className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search suppliers, customers, purchases..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="flex items-center gap-4">
        <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-green-50">
          <Bell className="h-5 w-5 text-green-700" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-green-900">{userName}</p>
            <Badge variant="secondary" className="text-xs">
              {getRoleLabel(userRole)}
            </Badge>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
