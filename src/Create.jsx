import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { captureAcquisitionFromUrl, saveAcquisition } from "./lib/analytics.js";

/** Legacy /create → /join funnel */
export default function Create() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    captureAcquisitionFromUrl(window.location.search);
    const ref = params.get("ref") || params.get("referrer_user_id");
    if (ref) saveAcquisition({ referrer_user_id: ref });
    navigate(`/join${window.location.search || ""}`, { replace: true });
  }, [navigate, params]);

  return null;
}
