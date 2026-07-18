import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/library";

const D = Decimal;

function makeUuid(key: string): string {
  const hash = createHash("sha1").update("broco-finance:" + key).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20,32);
}

function id(key: string): string { return makeUuid(key); }

type SheetRow = Record<string, unknown>;

type ExtractedClient = { id: string; name: string; contact: string | null };
type ExtractedProject = { id: string; clientId: string; name: string; isActive: boolean };
type ExtractedCategory = { id: string; name: string };
type ExtractedIncome = {
  id: string; clientId: string | null; projectId: string | null;
  type: string; concept: string; notes: string | null; status: "PAID";
  amountUsd: string; amountArs: string | null; exchangeRate: string | null;
  effectiveDate: string; dueDate: null;
};
type ExtractedExpense = {
  id: string; expenseCategoryId: string; projectId: string | null;
  type: string; concept: string; notes: string | null; status: "PAID";
  amountUsd: string; amountArs: string | null; exchangeRate: string | null;
  effectiveDate: string; dueDate: null;
};

// ---- CANONICAL DATA ----
const CLIENTS: ExtractedClient[] = [
  { id: id("client_pacsa"), name: "PACSA", contact: null },
  { id: id("client_coirini"), name: "Coirini S.A.", contact: null },
  { id: id("client_colegio"), name: "Colegio de Odontólogos de la Provincia de Santa Fe – 2ª Circunscripción", contact: null },
  { id: id("client_faufena"), name: "FAUFENA", contact: null },
  { id: id("client_zaphi"), name: "Zaphi World", contact: "Nicolás Oliveto" },
  { id: id("client_bertino"), name: "Bertino Integrales", contact: null },
  { id: id("client_rasafertil"), name: "RASAFERTIL", contact: null },
  { id: id("client_untoque"), name: "Un Toque de Amor", contact: null },
  { id: id("client_montanesa"), name: "Montañesa", contact: null },
  { id: id("client_districe"), name: "Districe", contact: null },
  { id: id("client_nihao"), name: "Nihao Negocios", contact: null },
  { id: id("client_athleta"), name: "Athleta Centro", contact: null },
  { id: id("client_lorenzo"), name: "Lorenzo Ferraro", contact: null },
];

const PROJECTS: ExtractedProject[] = [
  { id: id("proj_pacsa_whatsapp"), clientId: id("client_pacsa"), name: "Automatización WhatsApp", isActive: true },
  { id: id("proj_pacsa_listas"), clientId: id("client_pacsa"), name: "Listas de difusión", isActive: true },
  { id: id("proj_pacsa_caravanas"), clientId: id("client_pacsa"), name: "Gestión de Caravanas", isActive: true },
  { id: id("proj_pacsa_balanza"), clientId: id("client_pacsa"), name: "Módulo Balanza", isActive: true },
  { id: id("proj_coirini_rrss"), clientId: id("client_coirini"), name: "Gestión RRSS", isActive: true },
  { id: id("proj_colegio_certificados"), clientId: id("client_colegio"), name: "Certificados Digitales", isActive: true },
  { id: id("proj_colegio_firma"), clientId: id("client_colegio"), name: "Firma Digital", isActive: false },
  { id: id("proj_faufena_b2b"), clientId: id("client_faufena"), name: "Plataforma B2B", isActive: true },
  { id: id("proj_zaphi_odoo"), clientId: id("client_zaphi"), name: "Implementación Odoo", isActive: true },
  { id: id("proj_bertino_web"), clientId: id("client_bertino"), name: "Sitio Web", isActive: true },
  { id: id("proj_rasafertil_web"), clientId: id("client_rasafertil"), name: "Sitio Web", isActive: true },
  { id: id("proj_untoque_tienda"), clientId: id("client_untoque"), name: "Implementación Tiendanube", isActive: true },
  { id: id("proj_montanesa_caja"), clientId: id("client_montanesa"), name: "Sistema de Caja", isActive: true },
  { id: id("proj_districe_cotizador"), clientId: id("client_districe"), name: "Cotizador", isActive: false },
  { id: id("proj_districe_oc"), clientId: id("client_districe"), name: "Orden de Compra", isActive: true },
  { id: id("proj_nihao_web"), clientId: id("client_nihao"), name: "Sitio Web", isActive: true },
  { id: id("proj_athleta_gestion"), clientId: id("client_athleta"), name: "Sistema de Gestión", isActive: true },
  { id: id("proj_lorenzo_rfn"), clientId: id("client_lorenzo"), name: "RFN Argentina - Sistema de Gestión", isActive: true },
];

const CATEGORIES: ExtractedCategory[] = [
  { id: id("cat_infra"), name: "Infraestructura y Hosting" },
  { id: id("cat_dominios"), name: "Dominios" },
  { id: id("cat_herramientas"), name: "Herramientas" },
  { id: id("cat_publicidad"), name: "Publicidad" },
  { id: id("cat_contabilidad"), name: "Contabilidad y Legal" },
  { id: id("cat_prospeccion"), name: "Prospección y Demos" },
  { id: id("cat_marketing"), name: "Marketing" },
  { id: id("cat_email"), name: "Email" },
  { id: id("cat_sueldos"), name: "Sueldos y Honorarios" },
  { id: id("cat_viajes"), name: "Viajes y Viáticos" },
  { id: id("cat_hardware"), name: "Hardware" },
  { id: id("cat_otros"), name: "Otros" },
  { id: id("cat_utilidad"), name: "Utilidad" },
  { id: id("cat_comision"), name: "Comisión por venta" },
];

// ---- HELPERS ----
function cleanText(v: unknown): string | null { if (v == null) return null; const t = String(v).replace(/\s+/g, " ").trim(); return t || null; }
function parseCurrency(v: unknown): number | null { const t = cleanText(v); if (!t) return null; const n = t.replace(/\$/g, "").replace(/\s+/g, ""); const s = n.includes(",") && n.lastIndexOf(",") > n.lastIndexOf(".") ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, ""); const a = Number(s); return Number.isFinite(a) ? a : null; }
function parseCurrencyStr(v: unknown): string | null { const t = cleanText(v); if (!t) return null; const n = t.replace(/\$/g, "").replace(/\s+/g, ""); const s = n.includes(",") && n.lastIndexOf(",") > n.lastIndexOf(".") ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, ""); return /^[0-9]+(\.[0-9]+)?$/.test(s) ? s : null; }
function parseDate(v: unknown): string | null { if (v == null) return null; const t = cleanText(v); if (!t) return null; const parts = t!.split("/"); if (parts.length === 3) { let d = parseInt(parts[0],10), m = parseInt(parts[1],10)-1, y = parseInt(parts[2],10); if (y<100) y+=2000; const dt = new Date(y,m,d); if (!isNaN(dt.getTime()) && dt.getFullYear()===y && dt.getMonth()===m) return dt.toISOString().slice(0,10); } const dt = new Date(t!); return !isNaN(dt.getTime()) ? dt.toISOString().slice(0,10) : null; }
function toFixed6(d: Decimal): string { return d.toFixed(6); }
function toFixed2(d: Decimal): string { return d.toFixed(2); }
function dec(v: number | string): Decimal { return new D(v); }

function consistentAmount(arsStr: string, usdStr: string): { amountUsd: string; exchangeRate: string; amountArs: string } {
  const ars = dec(arsStr);
  const usd = dec(usdStr);
  const rate = ars.dividedBy(usd);
  const rate6 = dec(rate.toFixed(6));
  const usd6 = ars.dividedBy(rate6).toFixed(6);
  return { amountUsd: usd6, exchangeRate: rate6.toFixed(6), amountArs: ars.toFixed(2) };
}

function usdOnlyStr(usdStr: string): string {
  return dec(usdStr).toFixed(6);
}

function normName(s: string): string { return s.replace(/\s+/g," ").trim().replace(/Automatizacion\b/i,"Automatización").replace(/Lista de difusión/i,"Listas de difusión").replace(/eCommerce/i,"Implementación Tiendanube").replace(/Gestion\b/i,"Gestión").replace(/Modulo\b/i,"Módulo").replace(/Difusion\b/i,"Difusión").replace(/Sistema caja/i,"Sistema de Caja"); }
function mapProjName(raw: string): string { const n = normName(raw); if (/^(Automatizacion|Automatización|Bot wsp)/i.test(n)) return "Automatización WhatsApp"; if (/^(Estampilla|Digitalización|Estampilla \+)/i.test(n)) return "Certificados Digitales"; if (/^eCommerce$/i.test(n)) return "Implementación Tiendanube"; if (/^Gestion$/i.test(n)) return n; return n; }

const CAT_MAP: Record<string,string> = { "Infra/Cloud":"Infraestructura y Hosting","Hosting/Dominios":"Dominios","Herramientas/Software":"Herramientas","Publicidad (ads)":"Publicidad","Publicidad (Ads)":"Publicidad","Contabilidad/Legal":"Contabilidad y Legal","Prospección/Demos":"Prospección y Demos","Email/Zoho":"Email","Sueldos/Honorarios":"Sueldos y Honorarios","Viajes/Viáticos":"Viajes y Viáticos","Marketing":"Marketing","Hardware":"Hardware","Otros":"Otros" };
function mapCat(r: string): string { return CAT_MAP[r] ?? r; }

function clientId(raw: string): string | null {
  const n = raw.trim();
  if (/^(COIRINI|Coirini)/i.test(n)) return id("client_coirini");
  if (/^PACSA$/i.test(n)) return id("client_pacsa");
  if (/^COLEGIO$/i.test(n)) return id("client_colegio");
  if (/^FAUFENA$/i.test(n)) return id("client_faufena");
  if (/^(Nico|Nicolás|Oliveto|Zaphi)/i.test(n)) return id("client_zaphi");
  if (/^BERTINO$/i.test(n)) return id("client_bertino");
  if (/^RASAFERTIL$/i.test(n)) return id("client_rasafertil");
  if (/UN TOQUE/i.test(n)) return id("client_untoque");
  if (/^MONTAÑESA$/i.test(n)) return id("client_montanesa");
  if (/^DISTRICE$/i.test(n)) return id("client_districe");
  if (/^NIHAO$/i.test(n)) return id("client_nihao");
  if (/^ATHLETA$/i.test(n)) return id("client_athleta");
  if (/^RFN$/i.test(n)) return id("client_lorenzo");
  return null;
}

function projId(cid: string | null, name: string): string | null {
  if (!cid) return null;
  const p = PROJECTS.find(p => p.clientId === cid && p.name === name);
  return p?.id ?? null;
}

// ---- MAIN ----
function main() {
  const xlsxPath = process.argv[2] || path.resolve(process.cwd(), "Finanzas Broco Solutions.xlsx");
  if (!fs.existsSync(xlsxPath)) { console.error("No se encontro:", xlsxPath); process.exit(1); }
  console.log("Leyendo:", xlsxPath);
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const ri = XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets["Ingresos"], { defval: null, raw: false });
  const re = XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets["Gastos"], { defval: null, raw: false });
  console.log("Ingresos raw:", ri.length, "Gastos raw:", re.length);

  const incomes: ExtractedIncome[] = [];
  const expenses: ExtractedExpense[] = [];
  let ii = 0, ei = 0;

  for (const r of ri) {
    const fecha = parseDate(r["Fecha"]), rc = cleanText(r["Cliente"]), rp = cleanText(r["Proyecto"]), rt = cleanText(r["Tipo de Ingreso"]), obs = cleanText(r["Observaciones"]), ars = parseCurrency(r["Monto ARS"]), usd = parseCurrency(r["Monto USD"]), arsS = parseCurrencyStr(r["Monto ARS"]), usdS = parseCurrencyStr(r["Monto USD"]);
    if (!fecha) { if (ars||usd) console.log("  [skip] Ingreso sin fecha (total)"); continue; }
    if (!usd) { console.log("  [skip] Ingreso sin USD:", fecha); continue; }

    if (!rc && !rp && !rt && obs?.toLowerCase().includes("ajuste")) {
      const c = arsS && usdS ? consistentAmount(arsS, usdS) : null;
      incomes.push({ id: id("inc_"+String(ii++).padStart(2,"0")), clientId: null, projectId: null, type: "OTHER", concept: "Ajuste por intereses", notes: obs, status: "PAID", amountUsd: c ? c.amountUsd : usdOnlyStr(usdS!), amountArs: c ? c.amountArs : null, exchangeRate: c ? c.exchangeRate : null, effectiveDate: fecha, dueDate: null });
      console.log("  [INGRESO] OTHER Ajuste por intereses USD=", usd);
      continue;
    }
    // Allow null tipo — will be treated as DEVELOPMENT for known clients
    if (!rc || !rp) { console.log("  [skip] Ingreso sin cliente/proyecto:", fecha); continue; }

    let type: string, concept: string;
    const tl = (rt || "").toLowerCase();
    if (tl.includes("adelanto")) { type = "DEVELOPMENT"; concept = "Adelanto"; }
    else if (tl.includes("pago final")) { type = "DEVELOPMENT"; concept = "Pago final"; }
    else if (tl.includes("recurrente")) { type = "MAINTENANCE"; concept = "Recurrente"; }
    else if (tl === "") { type = "DEVELOPMENT"; concept = "Desarrollo"; }
    else { console.log("  [skip] Tipo desconocido:", rt); continue; }

    let cid: string | null, pname: string;
    if (/Nico|Oliveto/i.test(rc)) { cid = id("client_zaphi"); pname = "Implementación Odoo"; concept = "Soporte"; }
    else if (/^RFN$/i.test(rc)) { cid = id("client_lorenzo"); pname = "RFN Argentina - Sistema de Gestión"; }
    else if (/^ATHLETA$/i.test(rc)) { cid = id("client_athleta"); pname = "Sistema de Gestión"; }
    else { cid = clientId(rc); pname = mapProjName(rp); }
    const pid = projId(cid, pname);

    const c = arsS && usdS ? consistentAmount(arsS, usdS) : null;
    incomes.push({ id: id("inc_"+String(ii++).padStart(2,"0")), clientId: cid, projectId: pid, type, concept, notes: obs, status: "PAID", amountUsd: c ? c.amountUsd : usdOnlyStr(usdS!), amountArs: c ? c.amountArs : null, exchangeRate: c ? c.exchangeRate : null, effectiveDate: fecha, dueDate: null });
    console.log("  [INGRESO]", type, concept, "USD=", usd, "proj=", pname);
  }

  for (const r of re) {
    const fecha = parseDate(r["Fecha"]), rt = cleanText(r["Tipo de Gasto"]), rc = cleanText(r["Categoría"]), rp = cleanText(r["Proyecto (si aplica)"]), obs = cleanText(r["Observaciones"]), ars = parseCurrency(r["Monto ARS"]), usd = parseCurrency(r["Monto USD"]), arsS = parseCurrencyStr(r["Monto ARS"]), usdS = parseCurrencyStr(r["Monto USD"]);
    if (!fecha) { console.log("  [skip] Gasto sin fecha"); continue; }
    if (!usd) { console.log("  [skip] Gasto sin USD:", fecha); continue; }
    if (!rc) { console.log("  [skip] Gasto sin categoria:", fecha); continue; }
    if (!obs) { console.log("  [skip] Gasto sin observacion:", fecha); continue; }

    let expType = rt?.toLowerCase().includes("variable") ? "VARIABLE" : "FIXED";
    let catName = mapCat(rc);
    let concept = obs;
    let notes: string | null = null;
    let pid: string | null = null;

    // ChatGPT 2026-02-04 correction
    if (fecha === "2026-02-04" && rc === "Infra/Cloud" && obs === "ChatGPT" && expType === "VARIABLE") {
      expType = "FIXED"; catName = "Herramientas"; concept = "ChatGPT";
      notes = "Correccion de dato historico: la fila original del Excel figuraba como Variable / Infra/Cloud. Se normalizo a Fijo / Herramientas por consistencia con el resto de los cargos de ChatGPT.";
      console.log("  [GASTO] CORRECCION ChatGPT 2026-02-04");
    }
    // Mehc + Coirini split
    if (obs === "Mehc + Coirini" && arsS && usdS) {
      const dArs = dec(arsS), dUsd = dec(usdS);
      const halfArs = dArs.dividedBy(2);
      const halfUsd = dUsd.dividedBy(2);
      const restArs = dArs.minus(halfArs);
      const restUsd = dUsd.minus(halfUsd);
      const c1 = consistentAmount(halfArs.toString(), halfUsd.toString());
      const c2 = consistentAmount(restArs.toString(), restUsd.toString());
      expenses.push({ id: id("exp_"+String(ei++).padStart(2,"0")), expenseCategoryId: id("cat_marketing"), projectId: id("proj_coirini_rrss"), type: expType, concept: "Mehc + Coirini (50% Coirini)", notes: "Division Mehc + Coirini: primera mitad ARS="+halfArs.toFixed(2)+" USD="+halfUsd.toFixed(6), status: "PAID", amountUsd: c1.amountUsd, amountArs: c1.amountArs, exchangeRate: c1.exchangeRate, effectiveDate: fecha, dueDate: null });
      expenses.push({ id: id("exp_"+String(ei++).padStart(2,"0")), expenseCategoryId: id("cat_marketing"), projectId: null, type: expType, concept: "Mehc + Coirini (50% sin proyecto)", notes: "Division Mehc + Coirini: segunda mitad ARS="+restArs.toFixed(2)+" USD="+restUsd.toFixed(6), status: "PAID", amountUsd: c2.amountUsd, amountArs: c2.amountArs, exchangeRate: c2.exchangeRate, effectiveDate: fecha, dueDate: null });
      console.log("  [GASTO] DIVISION Mehc + Coirini");
      continue;
    }
    // Category + project mappings
    if (obs === "Dominio Rasafertil") { catName = "Dominios"; pid = id("proj_rasafertil_web"); }
    if (obs === "Mehc - Tercerización RRSS Coirini") { catName = "Marketing"; pid = id("proj_coirini_rrss"); }
    if (obs === "Mehc") catName = "Marketing";
    if (/Comisión Lis/i.test(obs)) { catName = "Comisión por venta"; if (/PACSA/i.test(obs)) pid = id("proj_pacsa_caravanas"); if (/Rasafertil/i.test(obs)) pid = id("proj_rasafertil_web"); }
    if (/Flete.*PACSA/i.test(obs)) { catName = "Viajes y Viáticos"; pid = id("proj_pacsa_caravanas"); }
    if (/Almuerzo.*Colegio/i.test(obs)) { catName = "Viajes y Viáticos"; pid = id("proj_colegio_certificados"); }
    if (/Desayuno/i.test(obs)) catName = "Viajes y Viáticos";
    if (/Rackspace/i.test(obs)) catName = "Infraestructura y Hosting";
    if (/^GCP$/i.test(obs)) catName = "Infraestructura y Hosting";
    if (/LinkedIn/i.test(obs)) catName = "Publicidad";
    if (/Monotributo|Montributo|IIBB|Registro/i.test(obs)) catName = "Contabilidad y Legal";
    if (/^ChatGPT$|^v0$|Twilio/i.test(obs)) catName = "Herramientas";
    if (/Sueldos|Honorarios|750 usd|retiro|Retiro|salario|Salario|sueldo|Sueldo/i.test(obs)) catName = "Sueldos y Honorarios";
    if (/Stickers|Escalamos/i.test(obs)) catName = "Marketing";
    if (/Memoria|Chips/i.test(obs)) catName = "Hardware";
    if (/V0.*Chat.*Rackspace.*GCP/i.test(obs)) catName = "Herramientas";

    const catId = CATEGORIES.find(c => c.name === catName)?.id;
    if (!catId) { console.log("  [skip] Categoria no canonica:", catName); continue; }

    const c = arsS && usdS ? consistentAmount(arsS, usdS) : null;
    expenses.push({ id: id("exp_"+String(ei++).padStart(2,"0")), expenseCategoryId: catId, projectId: pid, type: expType, concept, notes, status: "PAID", amountUsd: c ? c.amountUsd : usdOnlyStr(usdS!), amountArs: c ? c.amountArs : null, exchangeRate: c ? c.exchangeRate : null, effectiveDate: fecha, dueDate: null });
    console.log("  [GASTO]", expType, catName, concept, "USD=", usd);
  }

  // Write output
  const out = path.resolve(process.cwd(), "prisma/seed-data");
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
  function w(fn: string, n: string, d: unknown) { fs.writeFileSync(path.join(out,fn), "// Generado: "+new Date().toISOString()+"\nexport const "+n+" = "+JSON.stringify(d,null,2)+" as const;\n","utf-8"); }
  w("clients.ts", "seedClients", CLIENTS);
  w("projects.ts", "seedProjects", PROJECTS);
  w("expense-categories.ts", "seedCategories", CATEGORIES);
  w("incomes.ts", "seedIncomes", incomes);
  w("expenses.ts", "seedExpenses", expenses);
  fs.writeFileSync(path.join(out,"index.ts"), 'export { seedClients } from "./clients";\nexport { seedProjects } from "./projects";\nexport { seedCategories } from "./expense-categories";\nexport { seedIncomes } from "./incomes";\nexport { seedExpenses } from "./expenses";\n', "utf-8");

  console.log("\n=== REPORTE ===");
  console.log("Clientes:", CLIENTS.length, "Proyectos:", PROJECTS.length, "Categorias:", CATEGORIES.length, "Ingresos:", incomes.length, "Gastos:", expenses.length);
  const totalIncomeUsd = incomes.reduce((s, i) => s.plus(dec(i.amountUsd)), dec(0));
  const totalExpenseUsd = expenses.reduce((s, e) => s.plus(dec(e.amountUsd)), dec(0));
  console.log("Total USD ingresos:", totalIncomeUsd.toFixed(2));
  console.log("Total USD gastos:", totalExpenseUsd.toFixed(2));
}

main();
