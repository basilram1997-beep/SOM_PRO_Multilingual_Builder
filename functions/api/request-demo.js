const RECIPIENT_EMAIL = "BasilRam1997@gmail.com";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMailtoUrl(data) {
  const subject = encodeURIComponent(`طلب نسخة تجريبية - ${data.fullName || data.schoolName || "SOM PRO"}`);
  const body = encodeURIComponent(
    [
      `الاسم الكامل: ${data.fullName || "-"}`,
      `اسم المدرسة: ${data.schoolName || "-"}`,
      `البريد الإلكتروني: ${data.email || "-"}`,
      `رقم الهاتف: ${data.phone || "-"}`,
      "",
      `الرسالة: ${data.message || "-"}`,
    ].join("\n")
  );
  return `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`;
}

function readField(formData, key) {
  return String(formData.get(key) || "").trim();
}

export async function onRequestPost(context) {
  let submitted = { fullName: "", schoolName: "", email: "", phone: "", message: "" };
  try {
    const formData = await context.request.formData();
    const fullName = (submitted.fullName = readField(formData, "fullName"));
    const schoolName = (submitted.schoolName = readField(formData, "schoolName"));
    const email = (submitted.email = readField(formData, "email"));
    const phone = (submitted.phone = readField(formData, "phone"));
    const message = (submitted.message = readField(formData, "message"));

    if (!fullName || !schoolName || !email || !phone) {
      return Response.json(
        {
          ok: false,
          error: "MISSING_REQUIRED_FIELDS",
          fallbackUrl: buildMailtoUrl({ fullName, schoolName, email, phone, message }),
        },
        { status: 400 }
      );
    }

    const emailBinding = context.env.EMAIL;
    const fromAddress = String(context.env.TRIAL_FROM_EMAIL || "").trim();
    const fromName = String(context.env.TRIAL_FROM_NAME || "SOM PRO").trim();

    if (!emailBinding || typeof emailBinding.send !== "function") {
      return Response.json(
        {
          ok: false,
          error: "EMAIL_BINDING_NOT_CONFIGURED",
          fallbackUrl: buildMailtoUrl({ fullName, schoolName, email, phone, message }),
        },
        { status: 501 }
      );
    }

    if (!fromAddress) {
      return Response.json(
        {
          ok: false,
          error: "FROM_ADDRESS_NOT_CONFIGURED",
          fallbackUrl: buildMailtoUrl({ fullName, schoolName, email, phone, message }),
        },
        { status: 500 }
      );
    }

    const subject = `طلب نسخة تجريبية - ${fullName} / ${schoolName}`;
    const text = [
      "طلب نسخة تجريبية من موقع SOM PRO",
      "",
      `الاسم الكامل: ${fullName}`,
      `اسم المدرسة: ${schoolName}`,
      `البريد الإلكتروني: ${email}`,
      `رقم الهاتف: ${phone}`,
      "",
      `الرسالة: ${message || "-"}`,
    ].join("\n");

    const html = `
      <div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;line-height:1.8;color:#0f172a">
        <h2>طلب نسخة تجريبية من SOM PRO</h2>
        <p><strong>الاسم الكامل:</strong> ${escapeHtml(fullName)}</p>
        <p><strong>اسم المدرسة:</strong> ${escapeHtml(schoolName)}</p>
        <p><strong>البريد الإلكتروني:</strong> ${escapeHtml(email)}</p>
        <p><strong>رقم الهاتف:</strong> ${escapeHtml(phone)}</p>
        <p><strong>الرسالة:</strong> ${escapeHtml(message || "-")}</p>
      </div>
    `;

    const result = await emailBinding.send({
      to: RECIPIENT_EMAIL,
      from: { email: fromAddress, name: fromName },
      replyTo: email,
      subject,
      text,
      html,
    });

    return Response.json({
      ok: true,
      messageId: result?.messageId || null,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "REQUEST_DEMO_SEND_FAILED",
        fallbackUrl: buildMailtoUrl(submitted),
      },
      { status: 500 }
    );
  }
}

export async function onRequestGet() {
  return new Response("Method not allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
