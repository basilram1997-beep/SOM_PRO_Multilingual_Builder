import { useEffect, useState, type FormEvent } from "react";
import { somApi } from "../../api/somApi";
import { setAuthToken } from "../../api/http";
import type { AuthUser } from "./authTypes";

let rememberedLoginEmail = "";
let rememberedLoginEnabled = false;

type CreateRole = "STUDENT" | "PARENT" | "TEACHER" | "HOMEROOM_TEACHER";

const labels = {
  title: "تسجيل الدخول",
  licenseCode: "كود الترخيص",
  username: "اسم المستخدم",
  password: "كلمة المرور",
  passwordShort: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
  remember: "حفظ بيانات الدخول على هذا الجهاز",
  login: "دخول",
  loading: "جارٍ الدخول...",
  failed: "اسم المستخدم أو كلمة المرور أو كود الترخيص غير صحيح",
  missingLicense: "أدخل كود الترخيص أولًا",
  licenseMismatch: "كود الترخيص لا يطابق ترخيص التثبيت على هذا الجهاز. استخدم نفس الكود الذي أدخلته أثناء التثبيت.",
  createCardTitle: "إنشاء حساب جديد",
  createCardHelp: "أدخل الاسم والبريد الإلكتروني وكلمة المرور ثم أنشئ الحساب مباشرة.",
  createCardHint: "يمكنك إنشاء حساب طالب أو ولي أمر أو معلم أو مربي صف.",
  createRole: "نوع الحساب",
  createStudent: "طالب",
  createParent: "ولي أمر",
  createTeacher: "معلم",
  createHomeroomTeacher: "مربي صف",
  createName: "اسم الحساب",
  createUsername: "البريد الإلكتروني",
  createPassword: "كلمة المرور",
  createAccount: "إنشاء الحساب",
  createCreating: "جارٍ الإنشاء...",
  createSaved: "تم إنشاء الحساب ويمكنك تسجيل الدخول به الآن",
  createFailed: "تعذر إنشاء الحساب",
  createRequired: "أكمل بيانات الحساب أولًا"
};

function normalizeCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function maskCode(value: string) {
  const clean = normalizeCode(value);
  if (clean.length <= 8) return clean || "-";
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function installLicenseCode() {
  return window.somDesktop?.licenseSetup?.licenseCode?.trim() || "";
}

async function createAccount(name: string, email: string, password: string, role: CreateRole) {
  const backendRole = role === "HOMEROOM_TEACHER" ? "TEACHER" : role;
  return somApi.auth.register({
    name,
    email,
    password,
    role: backendRole
  });
}

export function useLogin(onLogin: (user: AuthUser) => void) {
  const [licenseCode, setLicenseCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [createRole, setCreateRole] = useState<CreateRole>("PARENT");
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const setupLicenseCode = installLicenseCode();

  useEffect(() => {
    const installCode = setupLicenseCode.trim();
    if (installCode) {
      setLicenseCode(installCode);
    }

    if (rememberedLoginEnabled) {
      setRemember(true);
      if (rememberedLoginEmail) {
        setEmail(rememberedLoginEmail);
      }
    }
  }, [setupLicenseCode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredLicense = licenseCode.trim();

    if (enteredLicense && setupLicenseCode && normalizeCode(enteredLicense) !== normalizeCode(setupLicenseCode)) {
      setMessage(labels.licenseMismatch);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await somApi.auth.login(email, password, enteredLicense);
      setAuthToken(res.data.token);

      if (remember) {
        rememberedLoginEnabled = true;
        rememberedLoginEmail = res.data.user?.email || email.trim();
      } else {
        rememberedLoginEnabled = false;
        rememberedLoginEmail = "";
      }

      onLogin(res.data.user);
    } catch (error) {
      const fallbackMessage = error instanceof Error && error.message ? error.message : labels.failed;
      setMessage(fallbackMessage || labels.failed);
    } finally {
      setLoading(false);
    }
  }

  async function createLinkedAccount() {
    if (!createName.trim() || !createUsername.trim() || !createPassword.trim()) {
      setCreateMessage(labels.createRequired);
      return;
    }
    if (createPassword.length < 6) {
      setCreateMessage(labels.passwordShort);
      return;
    }

    setCreateSaving(true);
    setCreateMessage("");

    try {
      const response = await createAccount(createName.trim(), createUsername.trim(), createPassword, createRole);
      if (response?.data?.token) {
        setAuthToken(response.data.token);
      }
      if (response?.data?.user) {
        onLogin(response.data.user);
      }
      setCreateMessage(labels.createSaved);
      setEmail(response?.data?.user?.email || createUsername.trim());
      setPassword(createPassword);
      setCreateName("");
      setCreateUsername("");
      setCreatePassword("");
    } catch (error) {
      const fallbackMessage = error instanceof Error && error.message ? error.message : labels.createFailed;
      setCreateMessage(fallbackMessage || labels.createFailed);
    } finally {
      setCreateSaving(false);
    }
  }

  return {
    licenseCode,
    setLicenseCode,
    email,
    setEmail,
    password,
    setPassword,
    remember,
    setRemember,
    message,
    loading,
    setupLicenseCode,
    submit,
    labels,
    normalizeCode,
    maskCode,
    createRole,
    setCreateRole,
    createName,
    setCreateName,
    createUsername,
    setCreateUsername,
    createPassword,
    setCreatePassword,
    createMessage,
    createSaving,
    createLinkedAccount
  };
}
