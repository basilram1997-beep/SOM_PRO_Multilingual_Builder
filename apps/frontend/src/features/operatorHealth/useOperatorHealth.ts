import { useCallback, useState } from "react";
import { somApi } from "../../api/somApi";
import type { OperatorHealthResponse } from "./operatorHealthTypes";

export type OperatorHealthState = {
  data: OperatorHealthResponse | null;
  loading: boolean;
  error: string;
  load: () => Promise<void>;
};

export function useOperatorHealth(): OperatorHealthState {
  const [data, setData] = useState<OperatorHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await somApi.schools.operatorHealth();
      setData(response.data);
    } catch (failure) {
      setData(null);
      setError(failure instanceof Error ? failure.message : "تعذر تحميل صحة التشغيل");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}
