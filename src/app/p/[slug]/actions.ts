"use server";

import { cookies } from "next/headers";
import { verifyPassword, signSession } from "@/lib/project-access-crypto";
import { prisma } from "@/server/prisma";

type ActionResult = { success: true } | { success: false; message: string };

export async function portalLoginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = String(formData.get("slug") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!slug || !password) {
    return { success: false, message: "Contraseña incorrecta." };
  }

  const link = await prisma.projectShareLink.findUnique({
    where: { slug },
    select: { id: true, passwordHash: true, revokedAt: true, accessVersion: true },
  });

  if (!link || link.revokedAt) {
    return { success: false, message: "Contraseña incorrecta." };
  }

  const ok = await verifyPassword(password, link.passwordHash);
  if (!ok) {
    return { success: false, message: "Contraseña incorrecta." };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const signed = signSession({
    linkId: link.id,
    accessVersion: link.accessVersion,
    expiresAt,
  });

  cookies().set("portal_session", signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/p/${slug}`,
    maxAge: 7 * 24 * 60 * 60,
  });

  return { success: true };
}
