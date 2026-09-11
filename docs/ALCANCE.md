# Acuerdos de Casa Mexino

## Primera etapa

Portal público de diseño visual, texto breve, catálogo y mapa de Matehuala. Filtros de operación, tipo, precio y zona. Ficha de propiedad con galería. Acceso del equipo y administración persistente de propiedades, fotografías, precios, descripciones y coordenadas. Fraccionamientos con plano PDF/imagen convertido a imagen, lotes independientes y contornos seleccionables. Comisión privada predeterminada por desarrollo; comisión individual configurable por propiedad.

Fraccionamientos casi siempre de terceros. Cuando reportan una venta, marcar el lote vendido y registrar quién/fecha reportada, sin exigir información del comprador. Las ventas de Mexino tendrán un expediente en segunda etapa. Disponibilidad independiente de publicación: borrador, publicado u oculto. Asesores pueden cambiar precios y marcar vendido. Registrar autor e historial de cambios. No eliminar historial ni sobrescribir cambios concurrentes silenciosamente.

## Segunda etapa

### Implementado: clientes, ventas y cobranza

- Cliente con nombre y teléfono obligatorios; domicilio y notas opcionales.
- Apartados con cantidad y fecha del siguiente pago.
- Ventas ligadas a propiedad o lote, con precio pactado, enganche, mensualidad, plazo y forma de pago.
- Formas de pago: efectivo, transferencia, tarjeta u otro.
- Comisión fijada al registrar la operación.
- Cancelación en dos pasos: revisión y resolución final. Solo administradores pueden gestionarla; el inmueble no se libera durante la revisión.
- Expediente de cobranza con saldo pendiente, total recibido, vencido y próximo vencimiento.
- Registro de mensualidades y abonos extraordinarios con fecha, forma de pago, referencia y notas.
- Pagos parciales aplicados a las mensualidades más antiguas. El excedente reduce las últimas mensualidades sin eximir el siguiente vencimiento.
- Liquidación automática cuando el saldo llega a cero.
- Cancelación de pagos exclusiva para administradores, conservando motivo, autor e historial.

### Aprobado para desarrollo posterior

- Clientes, ventas, documentos, contacto, fecha, precio pactado y asesor.
- Comisión por porcentaje o monto, predeterminado 3% editable; fijar condiciones al registrar la venta. No modificar venta existente al cambiar precio o comisión del inventario.
- Enganche en parcialidades. Definir cuándo deben comenzar las mensualidades respecto a la conclusión del enganche.
- Cobranza opcional por desarrollo, con excepción por venta si se requiere. Mexino recibe el dinero donde administra mensualidades.
- Sin recargos. Vender no equivale a liquidar.
- Retener comisión desde el enganche, hasta el importe efectivamente recibido; completar retención con posteriores cobros, sin descontar más que la comisión pactada.
- Entregas a propietarios: cobrado menos comisión retenida menos entregas, con controles de devoluciones. No tratar todo el dinero cobrado como ingreso propio.
- Cancelación por administrador, devolución autorizada caso por caso, motivo e historial. Liberación del lote mediante flujo explícito.
- Caja solo efectivo: saldo inicial, ingresos, gastos, pagos a empleados, comisiones y cierre. Sin cuentas bancarias ni cálculo fiscal de nómina; sin reparto a asesores por ahora.
- Separar efectivo total, fondos de propietarios y fondos de Mexino. Retener comisión distribuye un cobro, no crea una segunda entrada de efectivo.

No se mezclan clientes ni información financiera con APIs públicas. Cobranza, caja, entregas, cancelaciones y administración de usuarios quedan restringidas a administradores según propuesta aceptada.
