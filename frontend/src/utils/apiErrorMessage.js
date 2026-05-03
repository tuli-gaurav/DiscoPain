/** Human-readable message from Axios / API failures */
export function getApiErrorMessage(error) {
  const body = error?.response?.data;
  const fromBody = typeof body?.message === "string" ? body.message : null;
  if (fromBody) return fromBody;
  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return "Cannot reach the API. Start the backend (folder backend → npm run dev) and open http://localhost:4000/health in the browser to verify it is up.";
  }
  if (error?.response?.status === 403) return "You do not have permission for this action.";
  return error?.message || "Request failed";
}
