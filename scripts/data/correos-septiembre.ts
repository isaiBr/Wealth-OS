import type { RawEmail } from "../../src/parsers/types";

const IBK = "Interbank Servicio al Cliente <servicioalcliente@netinterbank.com.pe>";
const BCP = "BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>";

// Correos reales de septiembre 2026, extraídos de Gmail vía Claude in Chrome.
// Se excluyen deliberadamente: "Se rechazó tu compra" (no es transacción) y
// un consumo de tarjeta de crédito del 31 de agosto (fuera de mes). El único
// consumo en USD (12 sept, $123.01) sí se incluye — se convierte a soles al
// tipo de cambio fijo de src/config/moneda.ts al insertarlo (ver
// scripts/rebuild-cuentas-bcp.ts).
export const RAW_EMAILS: RawEmail[] = [
  // --- Interbank ---
  {
    from: IBK,
    subject: "Isai Enrique, realizaste un consumo con tu Tarjeta Interbank Visa Débito Clásica",
    body: `Isai Enrique, realizaste un consumo con tu Tarjeta Interbank Visa Débito Clásica
Conoce el detalle:
Tarjeta: ****4871
Comercio: IO*ISAI ENRIQUE BRAVO S
Monto: S/. 2308.90
Fecha: 12/09/2026
Hora: 04:33 PM`,
  },
  {
    from: IBK,
    subject: "Constancia de Pago Plin",
    body: `Hola, ISAI, te enviamos tu

Constancia de Pago Plin

Código de operación

86147219

Fecha y hora

12 Sep 2026 08:35 PM

Cuenta cargo

Cuenta Simple

Soles

898 3271898560

Destinatario

Andrea V Neira A

Destino

Yape

Monto y moneda

S/ 1.00`,
  },
  // (Los otros 3 correos de ejemplo de Interbank guardados antes en
  // correos-ejemplo/ son de julio y agosto — fuera de septiembre, se
  // excluyen a propósito de esta carga.)

  // --- BCP ---
  {
    from: BCP,
    subject: "Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste una transferencia de S/ 90.00 desde tu Clasica.
Montos
Monto transferido S/ 90.00
Datos de la operación
Operación realizada Transferencia entre mis cuentas
Fecha y hora 12 de Septiembre de 2026 - 08:52 PM
Desde Clasica
**** 4009
Enviado a Clasica
**** 1051
Canal Banca Móvil BCP
Número de operación 05885234`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 31.40 con tu Tarjeta de Débito BCP en ROMA.
Monto
Total del consumo S/ 31.40
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 12 de setiembre de 2026 - 03:32 PM
Número de Tarjeta de Débito ************5526
Empresa ROMA
Número de operación 658107`,
  },
  {
    from: BCP,
    subject: "Constancia de Transferencia a Otros Bancos - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste una transferencia de S/ 400.00 desde tu Clasica.
Montos
Monto enviado S/ 400.00
Comisión S/ 0.00
Total cobrado S/ 400.00
Datos de la operación
Operación realizada Transferencia a otros bancos
Fecha y hora 12 de Septiembre de 2026 - 04:17 PM
Enviado a Isai Enrique Bravo S.
**** 6040
Banco destino Interbank
Moneda Soles
Tipo de envío Inmediato
Desde Clasica
**** 4009
Canal Banca Móvil BCP
Número de operación 03957432`,
  },
  {
    from: BCP,
    subject: "Constancia de Yapeo a Celular - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un yapeo a celular de S/ 500.00 desde tu Clasica Soles.
Montos
Monto enviado S/ 500.00
Datos de la operación
Operación realizada Yapear a celular
Fecha y hora 12 de septiembre de 2026 - 04:16 PM
Enviado a Isai Enrique Bravo S.
*** **9 864
Destino Interbank
Desde Clasica
**** 1051
Moneda Soles
Canal Banca Móvil BCP
Número de operación 03948205`,
  },
  {
    from: BCP,
    subject: "Constancia de Pago con QR - Servicios de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un yapeo a celular de S/ 6.70 desde tu Cuenta de ahorro Soles.
Montos
Monto enviado S/ 6.70
Datos de la operación
Operación realizada Pago con QR
Fecha y hora 10 de septiembre de 2026 - 10:03 AM
Enviado a Teodora Porras D.
Destino Yape
Desde Cuenta de ahorro
**** 4009
Moneda Soles
Canal Banca Móvil BCP
Número de operación 01287533`,
  },
  {
    from: BCP,
    subject: "Realizamos una devolución de una operación a tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Se ha devuelto el monto de S/ 26.90 a tu cuenta BCP.
Monto
Total devuelto S/ 26.90
Datos de la operación
Fecha y hora 06 de setiembre de 2026 - 03:50 AM
Número de Tarjeta ************5526
Nombre del Comercio DLC*UBER RIDES
Número de operación 212090`,
  },
  {
    from: BCP,
    subject: "Realizamos una devolución de una operación a tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Se ha devuelto el monto de S/ 11.90 a tu cuenta BCP.
Monto
Total devuelto S/ 11.90
Datos de la operación
Fecha y hora 06 de setiembre de 2026 - 03:57 AM
Número de Tarjeta ************5526
Nombre del Comercio DLC*UBER RIDES
Número de operación 769023`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de $ 123.01 con tu Tarjeta de Débito BCP en IO*ISAI ENRIQUE BRAVO S.
Monto
Total del consumo $ 123.01
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 12 de setiembre de 2026 - 06:45 PM
Número de Tarjeta de Débito ************5526
Empresa IO*ISAI ENRIQUE BRAVO S
Número de operación 039600`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 5.00 con tu Tarjeta de Débito BCP en PLIN-ALEXIS PRIETO.
Monto
Total del consumo S/ 5.00
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 09 de setiembre de 2026 - 09:46 AM
Número de Tarjeta de Débito ************5526
Empresa PLIN-ALEXIS PRIETO
Número de operación 571365`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 43.68 con tu Tarjeta de Débito BCP en PLIN-ISAI ENRIQUE BRAVO.
Monto
Total del consumo S/ 43.68
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 09 de setiembre de 2026 - 05:33 PM
Número de Tarjeta de Débito ************5526
Empresa PLIN-ISAI ENRIQUE BRAVO
Número de operación 382329`,
  },
  {
    from: BCP,
    subject: "ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO - BANCA MOVIL BCP",
    body: `Hola ISAI ENRIQUE,
¡Tu operación se realizó con éxito!
Operación realizada:
Pago de servicios
Número de operación:
02096520
Fecha y hora: Jueves, 03 Septiembre 2026 - 12:46 P. M.
Empresa: CALIDDA GAS NATURAL DE LIMA Y CALLAO
Servicio: CALIDDA RECIBO SOLES
Cuenta de origen: Cuenta de ahorros
**** 4009
Monto total: S/ 46.70`,
  },
  {
    from: BCP,
    subject: "ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO - BANCA MOVIL BCP",
    body: `Hola ISAI ENRIQUE,
¡Tu operación se realizó con éxito!
Operación realizada:
Pago de servicios
Número de operación:
02099602
Fecha y hora: Jueves, 03 Septiembre 2026 - 12:46 P. M.
Empresa: DIRECTV PERU SRL
Servicio: A.-MENSUALIDAD POSTPAGO
Cuenta de origen: Cuenta de ahorros
**** 4009
Monto total: S/ 77.00`,
  },
  {
    from: BCP,
    subject: "ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO - BANCA MOVIL BCP",
    body: `Hola ISAI ENRIQUE,
¡Tu operación se realizó con éxito!
Operación realizada:
Pago de servicios
Número de operación:
02105445
Fecha y hora: Jueves, 03 Septiembre 2026 - 12:46 P. M.
Empresa: PLUZ ANTES ENEL DISTRIBUCION LUZ
Servicio: PLUZ ANTES ENELDISTRIBUCIONLUZ
Cuenta de origen: Cuenta de ahorros
**** 4009
Monto total: S/ 174.00`,
  },
  {
    from: BCP,
    subject: "ENVIO AUTOMATICO - CONSTANCIA DE PAGO DE SERVICIO - BANCA MOVIL BCP",
    body: `Hola ISAI ENRIQUE,
¡Tu operación se realizó con éxito!
Operación realizada:
Pago de servicios
Número de operación:
02124285
Fecha y hora: Jueves, 03 Septiembre 2026 - 12:47 P. M.
Empresa: WIN INTERNET
Servicio: 01 PAGO SOLES
Cuenta de origen: Cuenta de ahorros
**** 4009
Monto total: S/ 129.00`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Crédito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 360.00 con tu Tarjeta de Crédito BCP en PLANSALUD CRP.
Monto
Total del consumo S/ 360.00
Datos de la operación
Operación realizada Consumo Tarjeta de Crédito
Fecha y hora 01 de setiembre de 2026 - 05:06 AM
Número de Tarjeta de Crédito ************1305
Empresa PLANSALUD CRP
Número de operación 0000303666`,
  },

  // --- Correos de 1-6 sept, agregados en la segunda pasada de datos ---
  {
    from: BCP,
    subject: "Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste una transferencia de S/ 40.00 desde tu Clasica.
Montos
Monto transferido S/ 40.00
Datos de la operación
Operación realizada Transferencia entre mis cuentas
Fecha y hora 05 de Septiembre de 2026 - 11:46 PM
Desde Clasica
**** 4009
Enviado a Clasica
**** 1051
Canal Banca Móvil BCP
Número de operación 07280248`,
  },
  {
    from: BCP,
    subject: "Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste una transferencia de S/ 100.00 desde tu Clasica.
Montos
Monto transferido S/ 100.00
Datos de la operación
Operación realizada Transferencia entre mis cuentas
Fecha y hora 06 de Septiembre de 2026 - 03:03 AM
Desde Clasica
**** 4009
Enviado a Clasica
**** 1051
Canal Banca Móvil BCP
Número de operación 00225625`,
  },
  {
    from: BCP,
    subject: "Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste una transferencia de S/ 50.00 desde tu Clasica.
Montos
Monto transferido S/ 50.00
Datos de la operación
Operación realizada Transferencia entre mis cuentas
Fecha y hora 03 de Septiembre de 2026 - 09:18 PM
Desde Clasica
**** 4009
Enviado a Clasica
**** 1051
Canal Banca Móvil BCP
Número de operación 21672071`,
  },
  {
    from: BCP,
    subject: "Constancia de Yapeo a Celular - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un yapeo a celular de S/ 120.00 desde tu Cuenta de ahorro Soles.
Montos
Monto enviado S/ 120.00
Datos de la operación
Operación realizada Yapear a celular
Fecha y hora 05 de septiembre de 2026 - 10:07 AM
Enviado a Ivan C Ledesma Q.
Destino Yape
Desde Cuenta de ahorro
**** 4009
Moneda Soles
Canal Banca Móvil BCP
Número de operación 01349507`,
  },
  {
    from: BCP,
    subject: "Constancia de Yapeo a Celular - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un yapeo a celular de S/ 80.00 desde tu Cuenta de ahorro Soles.
Montos
Monto enviado S/ 80.00
Datos de la operación
Operación realizada Yapear a celular
Fecha y hora 01 de septiembre de 2026 - 05:46 PM
Enviado a Victor M Sanchez L.
Destino Yape
Desde Cuenta de ahorro
**** 4009
Moneda Soles
Canal Banca Móvil BCP
Número de operación 04609009`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 8.89 con tu Tarjeta de Débito BCP en TAMBO VILLA-UPC.
Monto
Total del consumo S/ 8.89
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 05 de setiembre de 2026 - 10:36 AM
Número de Tarjeta de Débito ************5526
Empresa TAMBO VILLA-UPC
Número de operación 650786`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 7.50 con tu Tarjeta de Débito BCP en IZI*MOODSHI*005982419.
Monto
Total del consumo S/ 7.50
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 05 de setiembre de 2026 - 05:54 PM
Número de Tarjeta de Débito ************5526
Empresa IZI*MOODSHI*005982419
Número de operación 430463`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 37.90 con tu Tarjeta de Débito BCP en DLC*UBER RIDES.
Monto
Total del consumo S/ 37.90
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 05 de setiembre de 2026 - 11:53 PM
Número de Tarjeta de Débito ************5526
Empresa DLC*UBER RIDES
Número de operación 044929`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 1.00 con tu Tarjeta de Débito BCP en DLC*UBER RIDES.
Monto
Total del consumo S/ 1.00
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 06 de setiembre de 2026 - 12:35 AM
Número de Tarjeta de Débito ************5526
Empresa DLC*UBER RIDES
Número de operación 128911`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 26.90 con tu Tarjeta de Débito BCP en DLC*UBER RIDES.
Monto
Total del consumo S/ 26.90
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 06 de setiembre de 2026 - 03:04 AM
Número de Tarjeta de Débito ************5526
Empresa DLC*UBER RIDES
Número de operación 212090`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 28.20 con tu Tarjeta de Débito BCP en PYU*UBER.
Monto
Total del consumo S/ 28.20
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 06 de setiembre de 2026 - 03:50 AM
Número de Tarjeta de Débito ************5526
Empresa PYU*UBER
Número de operación 229264`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 11.90 con tu Tarjeta de Débito BCP en DLC*UBER RIDES.
Monto
Total del consumo S/ 11.90
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 06 de setiembre de 2026 - 03:55 AM
Número de Tarjeta de Débito ************5526
Empresa DLC*UBER RIDES
Número de operación 769023`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 33.90 con tu Tarjeta de Débito BCP en TOTTUS CHORRILLOS SCO.
Monto
Total del consumo S/ 33.90
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 03 de setiembre de 2026 - 09:21 PM
Número de Tarjeta de Débito ************5526
Empresa TOTTUS CHORRILLOS SCO
Número de operación 590988`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 15.00 con tu Tarjeta de Débito BCP en OXXO PINOS.
Monto
Total del consumo S/ 15.00
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 01 de setiembre de 2026 - 01:32 PM
Número de Tarjeta de Débito ************5526
Empresa OXXO PINOS
Número de operación 991300`,
  },
  {
    from: BCP,
    subject: "Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP",
    body: `Hola Isai Enrique,
Realizaste un consumo de S/ 6.50 con tu Tarjeta de Débito BCP en OXXO GROHMANN.
Monto
Total del consumo S/ 6.50
Datos de la operación
Operación realizada Consumo Tarjeta de Débito
Fecha y hora 01 de setiembre de 2026 - 09:43 PM
Número de Tarjeta de Débito ************5526
Empresa OXXO GROHMANN
Número de operación 584787`,
  },
];
