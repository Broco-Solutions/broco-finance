import {
  BriefcaseBusiness,
  CircleDollarSign,
  FolderKanban,
  LayoutDashboard,
  Activity,
} from "lucide-react";

export const navigationItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: BriefcaseBusiness },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/incomes", label: "Ingresos", icon: CircleDollarSign },
  { href: "/expenses", label: "Gastos", icon: Activity },
] as const;
