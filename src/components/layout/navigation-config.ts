import {
  BriefcaseBusiness,
  CircleDollarSign,
  LayoutDashboard,
  Activity,
  Layers,
} from "lucide-react";

export const navigationItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: BriefcaseBusiness },
  { href: "/projects", label: "Proyectos", icon: Layers },
  { href: "/incomes", label: "Ingresos", icon: CircleDollarSign },
  { href: "/expenses", label: "Gastos", icon: Activity },
] as const;
