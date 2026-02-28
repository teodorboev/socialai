import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminSidebar />

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="py-8 px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-100 rounded"></div>
            <div className="h-64 bg-gray-50 rounded"></div>
          </div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
