// netlify/functions/izipay-create-payment.js
//
// Genera el "formToken" de Izipay (API CreatePayment, familia Lyra/MiCuentaWeb V4)
// de forma segura desde el servidor. NUNCA se debe generar este token en el navegador,
// porque requiere las credenciales privadas (Usuario/Contraseña) del comercio.
//
// CONFIGURACIÓN REQUERIDA (Netlify → Site configuration → Environment variables):
//   IZIPAY_USERNAME  -> "Usuario" de las Claves de API REST (Back Office Vendedor)
//   IZIPAY_PASSWORD  -> "Contraseña" de las Claves de API REST (Back Office Vendedor)
// Estas credenciales las recibes de Izipay por correo una vez aprobada tu afiliación
// (necesitas RUC activo). Se configuran en Netlify, nunca en este archivo ni en el HTML.
//
// Antes de usar en producción, confirma el payload exacto contra la documentación oficial:
// https://developers.izipay.pe/api/#/operations/generate_token
// (la estructura de "amount"/"currency"/"customer" puede variar según la versión de API
// vigente en tu cuenta; este archivo sigue el patrón documentado en los SDK oficiales
// de Izipay para PHP/.NET: POST a /api-payment/V4/Charge/CreatePayment con Basic Auth).

const IZIPAY_ENDPOINT = "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const USER = process.env.IZIPAY_USERNAME;
  const PASS = process.env.IZIPAY_PASSWORD;

  if (!USER || !PASS) {
    // Aún no configuraste tus credenciales de Izipay en Netlify.
    // El frontend cae de forma automática a la opción "coordinar por WhatsApp".
    return {
      statusCode: 501,
      body: JSON.stringify({ error: "IZIPAY_NOT_CONFIGURED" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const amountSoles = Number(body.amount || 0);
    const orderId = body.orderId || "MDC-" + Date.now();
    const customer = body.customer || {};

    if (!amountSoles || amountSoles <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "INVALID_AMOUNT" }) };
    }

    // Izipay/Lyra espera el monto en la unidad mínima de la moneda (céntimos).
    const amountCents = Math.round(amountSoles * 100);

    const payload = {
      amount: amountCents,
      currency: "PEN",
      orderId: orderId,
      customer: {
        email: customer.email || "",
      },
    };

    const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");

    const resp = await fetch(IZIPAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok || !data.answer || !data.answer.formToken) {
      return { statusCode: 502, body: JSON.stringify({ error: "IZIPAY_ERROR", detail: data }) };
    }

    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "SERVER_ERROR", message: err.message }) };
  }
};
