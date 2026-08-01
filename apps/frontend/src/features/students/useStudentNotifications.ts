import { useEffect, useMemo, useState } from "react";
import type { SchoolClass } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { localizeClassName } from "../../i18n/displayNames";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { StudentNotificationRow } from "./studentTypes";

type NotificationFilterType = "" | "ATTENDANCE" | "INVITATION" | "PLEDGE" | "SCHOOL_MESSAGE";

export function useStudentNotifications() {
  const { t, language } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedType, setSelectedType] = useState<NotificationFilterType>("");
  const [notifications, setNotifications] = useState<StudentNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    let active = true;
    somApi.classes
      .list()
      .then((response) => {
        if (!active) return;
        setClasses(sortSchoolClasses((response.data || []) as SchoolClass[]));
      })
      .catch((error) => {
        if (!active) return;
        setMessage(userFacingErrorMessage(error, t("notifications.loadFailed")));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    setMessage("");
    setLoading(true);
    somApi.students
      .notifications(selectedClassId || undefined, 100, selectedType || undefined)
      .then((response) => {
        if (!active) return;
        setNotifications(response.data || []);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(userFacingErrorMessage(error, t("notifications.loadFailed")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedClassId, selectedType, reloadToken, t]);

  const counts = useMemo(() => {
    const total = notifications.length;
    const attendance = notifications.filter((item) => item.eventType === "ATTENDANCE").length;
    const invitations = notifications.filter((item) => item.eventType === "INVITATION").length;
    const pledges = notifications.filter((item) => item.eventType === "PLEDGE").length;
    const messages = notifications.filter((item) => item.eventType === "SCHOOL_MESSAGE").length;
    const sent = notifications.filter((item) => item.status === "SENT").length;
    const failed = notifications.filter((item) => item.status === "FAILED").length;
    const queued = notifications.filter((item) => item.status === "QUEUED").length;
    return { total, attendance, invitations, pledges, messages, sent, failed, queued };
  }, [notifications]);

  function refresh() {
    setMessage("");
    setReloadToken((token) => token + 1);
  }

  return {
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedType,
    setSelectedType,
    notifications,
    loading,
    message,
    setMessage,
    selectedClass,
    counts,
    refresh,
    localizeClassName,
    language,
    t
  };
}
