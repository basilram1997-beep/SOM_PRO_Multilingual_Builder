import { useEffect, useState } from "react";
import { somApi } from "../../api/somApi";
import type { ArchiveRow } from "./archiveTypes";

export function useArchive() {
  const [items, setItems] = useState<ArchiveRow[]>([]);

  async function load() {
    const res = await somApi.archive.list();
    setItems(res.data || []);
  }

  async function remove(date: string) {
    await somApi.archive.removeDay(date);
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return { items, load, remove };
}
