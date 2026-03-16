import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  RefreshCcw,
} from "lucide-react";

export const navigationItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: BriefcaseBusiness },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/incomes", label: "Ingresos", icon: CircleDollarSign },
  { href: "/expenses", label: "Gastos", icon: Activity },
  { href: "/recurring", label: "Recurrentes", icon: RefreshCcw },
  { href: "/distribution", label: "Distribución", icon: HandCoins },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
] as const;
