# Acuerdos de Casa Mexino

## Primera etapa

Portal público de diseño visual, texto breve, catálogo y mapa de Matehuala. Filtros de operación, tipo, precio y zona. Ficha de propiedad con galería. Acceso del equipo y administración persistente de propiedades, fotografías, precios, descripciones y coordenadas. Fraccionamientos con plano PDF/imagen convertido a imagen, lotes independientes y contornos seleccionables. Comisión privada predeterminada por desarrollo; comisión individual configurable por propiedad.

Fraccionamientos casi siempre de terceros. Cuando reportan una venta, marcar el lote vendido y registrar quién/fecha reportada, sin exigir información del comprador. Las ventas de Mexino tendrán un expediente en segunda etapa. Disponibilidad independiente de publicación: borrador, publicado u oculto. Asesores pueden cambiar precios y marcar vendido. Registrar autor e historial de cambios. No eliminar historial ni sobrescribir cambios concurrentes silenciosamente.

## Segunda etapa

### Implementado: clientes y ventas

- Cliente con nombre y teléfono obligatorios; domicilio y notas opcionales.
- Apartados con cantidad y fecha del siguiente pago.
- Ventas ligadas a propiedad o lote, con precio pactado, enganche, mensualidad, plazo y forma de pago.
- Formas de pago: efectivo, transferencia, tarjeta u otro.
- Comisión fijada al registrar la operación.
- Cancelación en dos pasos: revisión y resolución final. Solo administradores pueden gestionarla; el inmueble no se libera durante la revisión.

### Aprobado para desarrollo posterior

- Clientes, ventas, documentos, contacto, fecha, precio pactado y asesor.
- Comisión por porcentaje o monto, predeterminado 3% editable; fijar condiciones al registrar la venta. No modificar venta existente al cambiar precio o comisión del inventario.
- Enganche en parcialidades. Mensualidades fijas empiezan al completar el enganche, con fecha elegida por cliente. Definir el primer vencimiento concreto en el expediente.
- Cobranza opcional por desarrollo, con excepción por venta si se requiere. Mexino recibe el dinero donde administra mensualidades.
- Sin recargos. Pagos variables cubren primero atrasos; excedente reduce plazo sin eximir siguiente mensualidad. Mostrar saldo total y faltante a la fecha por separado. Vender no equivale a liquidar.
- Retener comisión desde el enganche, hasta el importe efectivamente recibido; completar retención con posteriores cobros, sin descontar más que la comisión pactada.
- Entregas a propietarios: cobrado menos comisión retenida menos entregas, con controles de devoluciones. No tratar todo el dinero cobrado como ingreso propio.
- Cancelación por administrador, devolución autorizada caso por caso, motivo e historial. Liberación del lote mediante flujo explícito.
- Caja solo efectivo: saldo inicial, ingresos, gastos, pagos a empleados, comisiones y cierre. Sin cuentas bancarias ni cálculo fiscal de nómina; sin reparto a asesores por ahora.
- Separar efectivo total, fondos de propietarios y fondos de Mexino. Retener comisión distribuye un cobro, no crea una segunda entrada de efectivo.
- Los pagos parciales se aplican primero a las mensualidades más antiguas.

No se mezclan clientes ni información financiera con APIs públicas. Cobranza, caja, entregas, cancelaciones y administración de usuarios quedan restringidas a administradores según propuesta aceptada.
