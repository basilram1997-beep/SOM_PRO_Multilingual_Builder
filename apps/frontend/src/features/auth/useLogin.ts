import { useEffect, useMemo, useState, type FormEvent } from "react";
import { somApi } from "../../api/somApi";
import { setAuthToken } from "../../api/http";
import type { AuthUser } from "./authTypes";
import { useI18n } from "../../i18n/i18n";

let rememberedLoginEmail = "";
let rememberedLoginEnabled = false;

type CreateRole = "STUDENT" | "PARENT";

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

async function createAccount(
  name: string,
  email: string,
  password: string,
  role: CreateRole,
  studentNationalIds: string[],
  guardianPhone: string
) {
  return somApi.auth.register({
    name,
    email,
    password,
    role,
    studentNationalId: studentNationalIds[0] || "",
    studentNationalIds,
    guardianPhone
  });
}

export function useLogin(onLogin: (user: AuthUser) => void) {
  const { t } = useI18n();
  const labels = useMemo(
    () => ({
      title: t("login.title"),
      heroAriaLabel: t("login.heroAriaLabel"),
      systemStatus: t("login.systemStatus"),
      systemOnline: t("login.systemOnline"),
      systemOffline: t("login.systemOffline"),
      close: t("common.close"),
      licenseCode: t("login.licenseCode"),
      username: t("login.username"),
      password: t("login.password"),
      passwordShort: t("login.passwordShort"),
      remember: t("login.remember"),
      login: t("login.submit"),
      loading: t("login.loading"),
      failed: t("login.failed"),
      missingLicense: t("login.missingLicense"),
      licenseMismatch: t("login.licenseMismatch"),
      createCardTitle: t("login.createCardTitle"),
      createCardHelp: t("login.createCardHelp"),
      createCardHint: t("login.createCardHint"),
      createRole: t("login.createRole"),
      createStudent: t("login.createStudent"),
      createParent: t("login.createParent"),
      createTeacher: t("login.createTeacher"),
      createHomeroomTeacher: t("login.createHomeroomTeacher"),
      createName: t("login.createName"),
      createUsername: t("login.createUsername"),
      createPassword: t("login.createPassword"),
      createStudentNationalId: t("login.createStudentNationalId"),
      createStudentNationalIds: t("login.createStudentNationalIds"),
      createGuardianPhone: t("login.createGuardianPhone"),
      createAccount: t("login.createAccount"),
      createCreating: t("login.createCreating"),
      createSaved: t("login.createSaved"),
      createFailed: t("login.createFailed"),
      createRequired: t("login.createRequired")
    }),
    [t]
  );
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
  const [createStudentNationalIds, setCreateStudentNationalIds] = useState("");
  const [createGuardianPhone, setCreateGuardianPhone] = useState("");
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

    if (!enteredLicense) {
      setMessage(labels.missingLicense);
      return;
    }

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
    const studentNationalIds = createStudentNationalIds
      .split(/[\n,،]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!createName.trim() || !createUsername.trim() || !createPassword.trim() || studentNationalIds.length === 0) {
      setCreateMessage(labels.createRequired);
      return;
    }
    if (createRole === "PARENT" && !createGuardianPhone.trim()) {
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
      const response = await createAccount(
        createName.trim(),
        createUsername.trim(),
        createPassword,
        createRole,
        studentNationalIds,
        createGuardianPhone.trim()
      );
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
      setCreateStudentNationalIds("");
      setCreateGuardianPhone("");
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
    createStudentNationalIds,
    setCreateStudentNationalIds,
    createGuardianPhone,
    setCreateGuardianPhone,
    createMessage,
    createSaving,
    createLinkedAccount
  };
}
