"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { portalLogoutAction } from "./actions";

export function PortalLogoutButton({ slug }: { slug: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setPending(true);
    const fd = new FormData();
    fd.set("slug", slug);
    await portalLogoutAction(null, fd);
    setPending(false);
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      disabled={pending}
      className="shrink-0 border border-white/15 text-sm text-white/80 hover:bg-white/10 hover:text-white"
    >
      {pending ? "Saliendo..." : "Salir"}
    </Button>
  );
}
