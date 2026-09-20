export interface RawEmail {
  from: string;
  subject: string;
  body: string;
}

export type TipoTransaccion =
  | "compra"
  | "transferencia"
  | "retiro"
  | "pago_servicio"
  | "pago_tarjeta_credito"
  | "ingreso"
  | "devolucion";

export interface ParsedTransaction {
  banco: string;
  tipo: TipoTransaccion;
  monto: number;
  moneda: string;
  comercio?: string;
  descripcion?: string;
  fecha: string; // ISO 8601
  numeroOperacion?: string;
  /**
   * Clave de dedupe alterna para correos que no traen número de operación
   * (ej. notificación de consumo con tarjeta). Ver src/parsers/interbank.ts.
   */
  claveDedupAlterna?: string;
  /** true cuando el propio correo del banco confirma que es entre cuentas propias. */
  esTransferenciaInterna?: boolean;
  cuotaActual?: number;
  cuotaTotal?: number;
  ultimosDigitosTarjeta?: string;
  /**
   * Texto crudo identificando la cuenta de origen tal como aparece en el
   * correo (ej. "Cuenta Simple - 898 3271898560"). Resolver esto a un
   * cuenta_id real de la tabla `cuentas` es trabajo del paso de ingesta,
   * no del parser.
   */
  cuentaOrigenLabel?: string;
  /**
   * Cuando el correo no trae dígitos de cuenta para resolverla (ej. Yape no
   * expone número de cuenta, solo el celular) — se resuelve por la cuenta
   * marcada con esta billetera en `cuentas.billetera` en vez de por dígitos.
   */
  billeteraOrigen?: "yape" | "plin";
}

export interface BankParser {
  banco: string;
  /** true si este parser sabe procesar el correo (por remitente/asunto). */
  puedeParsear(email: RawEmail): boolean;
  /** null si puedeParsear() es true pero no reconoce el formato interno. */
  parsear(email: RawEmail): ParsedTransaction | null;
}
