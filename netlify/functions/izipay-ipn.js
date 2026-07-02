// netlify/functions/izipay-ipn.js
//
// Recibe la notificación servidor-a-servidor (IPN) que Izipay envía cuando
// una transacción cambia de estado. Esta es la fuente de verdad real de si
// un pago se completó (no el evento del navegador, que solo es para la UX).
//
// Configura esta URL como "URL de notificación (IPN)" en tu Back Office Vendedor
// de Izipay una vez tengas tus credenciales:
//   https://TU-SITIO.netlify.app/.netlify/functions/izipay-ipn
//
// Requiere la misma variable de entorno IZIPAY_PASSWORD (se usa como clave HMAC
// para validar la firma "kr-hash" del payload "kr-answer", según la documentación
// oficial de Izipay/Lyra). Antes de producción, confirma el algoritmo de verificación
// exacto contra: https://developers.izipay.pe/

const crypto = require("crypto");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const PASS = process.env.IZIPAY_PASSWORD;
  if (!PASS) {
    return { statusCode: 501, body: "IZIPAY_NOT_CONFIGURED" };
  }

  try {
    const params = new URLSearchParams(event.body || "");
    const krAnswer = params.get("kr-answer");
    const krHash = params.get("kr-hash");
    if (!krAnswer || !krHash) {
      return { statusCode: 400, body: "MISSING_FIELDS" };
    }

    const computedHash = crypto.createHmac("sha256", PASS).update(krAnswer).digest("hex");
    if (computedHash !== krHash) {
      return { statusCode: 401, body: "INVALID_SIGNATURE" };
    }

    const answer = JSON.parse(krAnswer);
    const orderStatus = answer.orderStatus; // "PAID" | "UNPAID" | ...

    if (orderStatus === "PAID") {
      // Aquí puedes reenviar la confirmación a tu Google Apps Script
      // (el mismo FORM_ENDPOINT que usas en el sitio) para registrar la venta
      // y disparar el correo/WhatsApp automático a hola@mercadodecafe.com.
      //
      // await fetch("TU_URL_DE_APPS_SCRIPT", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ type: "pedido_confirmado_ipn", answer }),
      // });
    }

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    return { statusCode: 500, body: "SERVER_ERROR: " + err.message };
  }
};
