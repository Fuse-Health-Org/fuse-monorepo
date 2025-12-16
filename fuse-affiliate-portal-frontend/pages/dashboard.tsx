import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { Spinner } from "@heroui/react";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to analytics page
    router.replace("/analytics");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}

